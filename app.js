require('dotenv').config()
const got = require('got')
const cron = require('node-cron')
const store = require('store')

const { CONSUMER_KEY, PADLOCAL_TOKEN } = process.env
const { account_1, account_2 } = require('./account')

// global account
let account = account_1

const getBearerToken = async () => {
    try {
        const { access_token } = await got
            .post('https://api.tdameritrade.com/v1/oauth2/token', {
                form: {
                    grant_type: 'refresh_token',
                    refresh_token: account.refresh_token,
                    client_id: CONSUMER_KEY,
                },
            })
            .json()
        return Promise.resolve(access_token)
    } catch (error) {
        return Promise.reject(error)
    }
}

const getPositions = async () => {
    try {
        const accessToken = store.get(account.id)
        const {
            securitiesAccount: { positions },
        } = await got(
            `https://api.tdameritrade.com/v1/accounts/${account.id}?fields=positions`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        ).json()
        return Promise.resolve(positions)
    } catch (error) {
        return Promise.reject(error)
    }
}

const generateReport = async () => {
    try {
        const positions = await getPositions()
        const raw = positions.reduce((acc, position) => {
            const { instrument, shortQuantity, longQuantity } = position
            let short, long, sym
            switch (instrument.assetType) {
                case 'EQUITY':
                    const { symbol } = instrument
                    short = shortQuantity / 100
                    long = longQuantity / 100
                    sym = symbol
                    break
                case 'OPTION':
                    const { underlyingSymbol, putCall } = instrument
                    short = putCall === 'CALL' ? shortQuantity : longQuantity
                    long = putCall === 'CALL' ? longQuantity : shortQuantity
                    sym = underlyingSymbol
                    break
                default:
                    return acc
            }
            return {
                ...acc,
                [sym]: {
                    long: acc[sym] ? acc[sym].long + long : long,
                    short: acc[sym] ? acc[sym].short + short : short,
                },
            }
        }, {})
        const report = Object.keys(raw)
            .sort((a, b) => a.localeCompare(b))
            .map((key) => ({
                symbol: key,
                short: raw[key].short,
                long: raw[key].long,
            }))
        return Promise.resolve(report)
    } catch (error) {
        return Promise.reject(error)
    }
}

const fs = require('fs')
const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))

const formatReport = (report) => {
    const currentTime = dayjs().tz('America/New_York')

    // concat string
    let reportString = `Portfolio Report of ${
        account.id
    }\n(on ${currentTime.format('lll')})\n\n`
    for (const item of report) {
        const { symbol, long, short } = item
        reportString += `${symbol}: \n${short} shorts, ${long} longs\n\n`
    }

    // write to file
    const filename = `./cache/report_${account.id}_${currentTime.unix()}.txt`
    fs.writeFileSync(filename, reportString)
    return FileBox.fromFile(filename)
}

const AV = require('leancloud-storage')
AV.init({
    appId: 'UkHdVwDNRyWvzd00PeHtDOPc-MdYXbMMI',
    appKey: 'JBg7kPsAAtUXFCuIpv1qJAuX',
})

const saveReport = async (report) => {
    try {
        await AV.Object.saveAll(
            report.map((item) => {
                const object = new AV.Object('Report')
                object.set(item)
                object.set('account', account.id)
                return object
            })
        )
    } catch (error) {
        console.error(error)
    }
}

const sleep = (second) =>
    new Promise((resolve) => setTimeout(resolve, second * 1000))

const cacheBearerToken = async () => {
    try {
        console.log('cache bearer tokens...')
        account = account_1
        store.set(account.id, await getBearerToken())
        await sleep(1)
        account = account_2
        store.set(account.id, await getBearerToken())
        console.log('bearer tokens cached...')
    } catch (error) {
        console.error(error)
    }
}

const { Wechaty, FileBox } = require('wechaty')
const { PuppetPadlocal } = require('wechaty-puppet-padlocal')

// Instantiate Wechaty
Wechaty.instance({
    name: 'OpCal-Bot',
    puppet: new PuppetPadlocal({
        token: PADLOCAL_TOKEN,
    }),
})
    .on('scan', (qrcode, status) => {
        // if (status === ScanStatus.Waiting && qrcode) {
        //     const qrcodeImageUrl = [
        //         'https://api.qrserver.com/v1/create-qr-code/?data=',
        //         encodeURIComponent(qrcode),
        //     ].join('')
        //     console.log(
        //         `onScan: ${ScanStatus[status]}(${status}) - ${qrcodeImageUrl}`
        //     )
        // } else {
        //     console.log(`onScan: ${ScanStatus[status]}(${status})`)
        // }
        require('qrcode-terminal').generate(qrcode, { small: true })
    })
    .on('login', async (user) => {
        try {
            console.log(`User ${user} logged in`)
            await cacheBearerToken()
        } catch (error) {
            console.error(error)
        }
    })
    .on('message', async (message) => {
        try {
            const text = message.text()
            if (message.self()) {
                if (message.to() && message.to().self()) {
                    if (/opcal/gim.test(text)) {
                        account = account_1
                        await message.say(
                            `generating report (${account.id})...`
                        )
                        const report = await generateReport()
                        await message.say(formatReport(report))
                    }

                    if (/liwei/gim.test(text)) {
                        account = account_2
                        await message.say(
                            `generating report (${account.id})...`
                        )
                        const report = await generateReport()
                        await message.say(formatReport(report))
                    }
                }
            }
        } catch (error) {
            console.error(error)
        }
    })
    .on('logout', (user) => {
        console.log(`User ${user} logout`)
    })
    .start()

cron.schedule(
    '05 16 * * 1-5',
    async () => {
        try {
            console.log('generating daily reports...')
            account = account_1
            await saveReport(await generateReport())
            account = account_2
            await saveReport(await generateReport())
            console.log('daily reports saved.')
        } catch (error) {
            console.error(error)
        }
    },
    {
        timezone: 'America/New_York',
    }
)

cron.schedule(
    '*/20 * * * *',
    async () => {
        try {
            await cacheBearerToken()
        } catch (error) {
            console.error(error)
        }
    },
    {
        timezone: 'America/New_York',
    }
)

module.exports = { getBearerToken, generateReport, formatReport, saveReport }
