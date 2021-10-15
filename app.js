require('dotenv').config()
const got = require('got')
const cron = require('node-cron')

// environemnt variables
const { REFRESH_TOKEN, CONSUMER_KEY, ACCOUNT_ID } = process.env

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
        return positions.reduce((acc, position) => {
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
    } catch (error) {
        console.error(error)
    }
}

const saveReport = async (report) => {
    try {
    } catch (error) {}
}

// Schedule the job to run
// at 16:05 on every day-of-week from Monday through Friday.
cron.schedule(
    '05 16 * * 1-5',
    async () => {
        const report = await generateReport()
        saveReport(report)
    },
    {
        timezone: 'America/New_York',
    }
)

module.exports = { generateReport }
