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
        const report = positions.reduce((acc, position) => {
            let { instrument, shortQuantity, longQuantity } = position
            switch (instrument.assetType) {
                case 'EQUITY':
                    const { symbol } = instrument
                    shortQuantity = shortQuantity / 100
                    longQuantity = longQuantity / 100

                    return {
                        [symbol]: {
                            long: acc[symbol]
                                ? acc[symbol].long + longQuantity
                                : longQuantity,
                            short: acc[symbol]
                                ? acc[symbol].short + shortQuantity
                                : shortQuantity,
                        },
                        ...acc,
                    }
                case 'OPTION':
                    const { underlyingSymbol, putCall } = instrument
                    shortQuantity =
                        putCall === 'CALL' ? shortQuantity : longQuantity
                    longQuantity =
                        putCall === 'CALL' ? longQuantity : shortQuantity

                    return {
                        [underlyingSymbol]: {
                            long: acc[underlyingSymbol]
                                ? acc[underlyingSymbol].long + longQuantity
                                : longQuantity,
                            short: acc[underlyingSymbol]
                                ? acc[underlyingSymbol].short + shortQuantity
                                : shortQuantity,
                        },
                        ...acc,
                    }
                default:
                    return acc
            }
        }, {})
        console.log(report)
    } catch (error) {
        console.error(error)
    }
}

// Schedule the job to run
// at 16:05 on every day-of-week from Monday through Friday.
cron.schedule(
    '05 16 * * 1-5',
    () => {
        generateReport()
    },
    {
        timezone: 'America/New_York',
    }
)

module.exports = { generateReport }
