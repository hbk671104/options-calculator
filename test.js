require('dotenv').config()
const { generateReport, formatReport } = require('./report')

;(async () => {
    let report = await generateReport()
    console.log(formatReport(report))
})()
