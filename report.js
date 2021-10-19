const { getPositions } = require('./request')

const generateReport = async () => {
    try {
        const positions = await getPositions()
        const raw = positions.reduce((acc, position) => {
            const { instrument, shortQuantity, longQuantity } = position
            let short, long, sym
            switch (instrument.assetType) {
                case 'EQUITY':
                    const { symbol } = instrument
                    short = shortQuantity / 100
                    long = longQuantity / 100
                    sym = symbol
                    break
                case 'OPTION':
                    const { underlyingSymbol, putCall } = instrument
                    short = putCall === 'CALL' ? shortQuantity : longQuantity
                    long = putCall === 'CALL' ? longQuantity : shortQuantity
                    sym = underlyingSymbol
                    break
                default:
                    return acc
            }
            return {
                ...acc,
                [sym]: {
                    long: acc[sym] ? acc[sym].long + long : long,
                    short: acc[sym] ? acc[sym].short + short : short,
                },
            }
        }, {})
        return Object.keys(raw)
            .sort((a, b) => a.localeCompare(b))
            .map((k) => ({
                symbol: k,
                long: raw[k].long,
                short: raw[k].short,
            }))
    } catch (error) {
        console.error(error)
    }
}

const fs = require('fs')
const dayjs = require('dayjs')
dayjs.extend(require('dayjs/plugin/localizedFormat'))
dayjs.extend(require('dayjs/plugin/utc'))
dayjs.extend(require('dayjs/plugin/timezone'))
const { FileBox } = require('wechaty')

const formatReport = (report) => {
    const currentTime = dayjs().tz('America/New_York')
    try {
        let reportString = `Portfolio Report \n(on ${currentTime.format(
            'lll'
        )})\n\n`
        for (const item of report) {
            const { symbol, long, short } = item
            reportString += `${symbol}: \n${short} shorts, ${long} longs\n\n`
        }
        // write to file
        const filename = `./cache/report_${currentTime.unix()}.txt`
        fs.writeFileSync(filename, reportString)
        return FileBox.fromFile(filename)
    } catch (error) {
        console.error(error)
    }
}

const AV = require('leancloud-storage')

const saveReport = async (report) => {
    try {
        for (const item of report) {
            const reportObject = new AV.Object('Report')
            reportObject.set(item)
            await reportObject.save()
        }
    } catch (error) {
        console.error(error)
    }
}

module.exports = {
    generateReport,
    formatReport,
    saveReport,
}
