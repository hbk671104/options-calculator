const { REFRESH_TOKEN_1, ACCOUNT_ID_1, REFRESH_TOKEN_2, ACCOUNT_ID_2 } =
    process.env

const account_1 = {
    id: ACCOUNT_ID_1,
    refresh_token: REFRESH_TOKEN_1,
}

const account_2 = {
    id: ACCOUNT_ID_2,
    refresh_token: REFRESH_TOKEN_2,
}

module.exports = {
    account_1,
    account_2,
}
