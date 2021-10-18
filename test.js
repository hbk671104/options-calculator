const { generateReport, formatReport } = require('./app')

;(async () => {
    let report = await generateReport()
    report = formatReport(report)
    console.log(report)
})()
