// environemnt variables
const { REFRESH_TOKEN, CONSUMER_KEY, ACCOUNT_ID } = process.env
const got = require('got')

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

module.exports = {
    getPositions,
    getMarketHours,
}