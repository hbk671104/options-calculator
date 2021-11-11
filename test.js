const {
    getBearerToken,
    generateReport,
    formatReport,
    saveReport,
    cacheBearerToken,
} = require('./app')

;(async () => {
    await cacheBearerToken()
    let report = await generateReport()
    console.log(report)
})()
