require('dotenv').config()
const got = require('got')
const cron = require('node-cron')

// environemnt variables
const { REFRESH_TOKEN, CONSUMER_KEY, ACCOUNT_ID, PADLOCAL_TOKEN } = process.env

const getBearerToken = async () => {
    try {
        const { access_token } = await got
            .post('https://api.tdameritrade.com/v1/oauth2/token', {
                form: {
                    grant_type: 'refresh_token',
                    refresh_token: REFRESH_TOKEN,
                    client_id: CONSUMER_KEY,
                },
            })
            .json()
        return access_token
    } catch (error) {
        console.error(error)
    }
}

const getPositions = async () => {
    try {
        const accessToken = await getBearerToken()
        const {
            securitiesAccount: { positions },
        } = await got(
            `https://api.tdameritrade.com/v1/accounts/${ACCOUNT_ID}?fields=positions`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        ).json()
        return positions
    } catch (error) {
        console.error(error)
    }
}

const getMarketHours = async (market = 'OPTION') => {
    try {
        const { option } = await got(
            `https://api.tdameritrade.com/v1/marketdata/${market}/hours?apikey=${CONSUMER_KEY}`
        ).json()
        return option
    } catch (error) {
        console.error(error)
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
        return Object.keys(raw)
            .sort((a, b) => a.localeCompare(b))
            .map((k) => ({
                symbol: k,
                long: raw[k].long,
                short: raw[k].short,
            }))
    } catch (error) {
        console.error(error)
    }
}

const fs = require('fs')
const dayjs = require('dayjs')
const localizedFormat = require('dayjs/plugin/localizedFormat')
dayjs.extend(localizedFormat)

const formatReport = (report) => {
    const currentTime = dayjs()
    try {
        let reportString = `Portfolio Report \n(on ${currentTime.format(
            'lll'
        )})\n\n`
        for (const item of report) {
            const { symbol, long, short } = item
            reportString += `${symbol}: \n${short} shorts, ${long} longs\n\n`
        }
        // write to file
        const filename = `./cache/report_${currentTime.unix()}.txt`
        fs.writeFileSync(filename, reportString)
        return FileBox.fromFile(filename)
    } catch (error) {
        console.error(error)
    }
}

const AV = require('leancloud-storage')

AV.init({
    appId: 'UkHdVwDNRyWvzd00PeHtDOPc-MdYXbMMI',
    appKey: 'JBg7kPsAAtUXFCuIpv1qJAuX',
})

const saveReport = async (report) => {
    try {
        for (const item of report) {
            const reportObject = new AV.Object('Report')
            reportObject.set(item)
            await reportObject.save()
        }
    } catch (error) {
        console.error(error)
    }
}

const { Wechaty, FileBox } = require('wechaty')
const { PuppetPadlocal } = require('wechaty-puppet-padlocal')

// Instantiate Wechaty
const wechaty = Wechaty.instance({
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
    .on('login', (user) => console.log(`User ${user} logged in`))
    .on('message', async (message) => {
        const text = message.text()
        if (message.self()) {
            if (message.to() && message.to().self()) {
                if (/opcal/gim.test(text)) {
                    await message.say('generating report...')
                    const report = await generateReport()
                    await message.say(formatReport(report))
                }
            }
        }
    })
    .on('logout', (user) => {
        console.log(`User ${user} logout`)
    })
    .start()

// Schedule the job to run
// at 16:05 on every day-of-week from Monday through Friday.
cron.schedule(
    '05 16 * * 1-5',
    async () => {
        await wechaty.say('generating report...')
        const report = await generateReport()
        await saveReport(report)
        await wechaty.say(formatReport(report))
    },
    {
        scheduled: true,
        timezone: 'America/New_York',
    }
)

module.exports = { generateReport, formatReport, saveReport }
