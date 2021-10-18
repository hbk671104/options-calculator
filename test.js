const { generateReport, formatReport } = require('./app')

;(async () => {
    let report = await generateReport()
    console.log(formatReport(report))
})()
