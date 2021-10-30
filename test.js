const { generateReport, formatReport, saveReport } = require('./app')

;(async () => {
    let report = await generateReport()
    // await saveReport(report)
    console.log(report)
})()
