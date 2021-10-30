const {
    getBearerToken,
    generateReport,
    formatReport,
    saveReport,
} = require('./app')

;(async () => {
    let token = await getBearerToken()
    console.log(token)
    // let report = await generateReport()
    // console.log(report)
})()
