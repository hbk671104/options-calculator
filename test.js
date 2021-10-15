const { generateReport } = require('./app')

;(async () => {
    const report = await generateReport()
    console.log(report)
})()
