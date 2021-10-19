require('dotenv').config()
const cron = require('node-cron')
const { generateReport, formatReport, saveReport } = require('./report')

// environemnt variables
const { PADLOCAL_TOKEN } = process.env

const { Wechaty } = require('wechaty')
const { PuppetPadlocal } = require('wechaty-puppet-padlocal')

// Instantiate Wechaty
const wechaty = Wechaty.instance({
    name: 'OpCal-Bot',
    puppet: new PuppetPadlocal({
        token: PADLOCAL_TOKEN,
    }),
})
    .on('scan', (qrcode, status) => {
        if (status === ScanStatus.Waiting && qrcode) {
            const qrcodeImageUrl = [
                'https://api.qrserver.com/v1/create-qr-code/?data=',
                encodeURIComponent(qrcode),
            ].join('')
            console.log(
                `onScan: ${ScanStatus[status]}(${status}) - ${qrcodeImageUrl}`
            )
        } else {
            console.log(`onScan: ${ScanStatus[status]}(${status})`)
        }
    })
    .on('login', (user) => console.log(`User ${user} logged in`))
    .on('message', async (message) => {
        const text = message.text()
        if (message.self()) {
            if (message.to() && message.to().self()) {
                if (/opcal/gim.test(text)) {
                    await message.say('generating report...')
                    const report = await generateReport()
                    await message.say(formatReport(report))
                }
            }
        }
    })
    .on('logout', (user) => {
        console.log(`User ${user} logout`)
    })
    .start()

// Schedule the job to run
// at 16:05 on every day-of-week from Monday through Friday.
cron.schedule(
    '05 16 * * 1-5',
    async () => {
        await wechaty.say('generating report...')
        const report = await generateReport()
        await saveReport(report)
        await wechaty.say(formatReport(report))
    },
    {
        scheduled: true,
        timezone: 'America/New_York',
    }
)

module.exports = { generateReport, formatReport, saveReport }
