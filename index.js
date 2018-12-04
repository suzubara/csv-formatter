#!/usr/bin/env node
const { Transform } = require('stream')
const { DateTime, Duration } = require('luxon')

/** CONSTANTS */
const US_PACIFIC = 'America/Los_Angeles'
const US_EASTERN = 'America/New_York'

const TIMESTAMP_FORMAT = 'M/d/yy h:mm:ss a'

const ZIP_FORMAT = /^\d{5}$/
const CSV_PATTERN = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g

const INVALID_DATA_ERROR = 'Invalid Data Format'
/** END CONSTANTS */

const parseCSV = new Transform({
  transform(chunk, encoding, callback) {
    // split by new line
    const lines = chunk.toString().split('\n')
    const [headers, ...data] = lines

    process.stdout.write(headers + '\n')

    data.forEach((row) => {
      this.push(row)
    })

    callback()
  }
})

const normalizeData = new Transform({
  transform(chunk, encoding, callback) {
    let row = parseCSVLine(chunk.toString())

    const [
      timestamp,
      address,
      zip,
      fullName,
      fooDuration,
      barDuration,
      totalDuration,
      notes,
    ] = row

    try {
      const formattedTimestamp = formatTimestamp(timestamp)
      const formattedZip = formatZip(zip)
      const formattedName = capitalizeString(fullName)
    
      const formattedFoo = formatDuration(fooDuration)
      const formattedBar = formatDuration(barDuration)
      const formattedTotal = formattedFoo.plus(formattedBar)
  
      const formattedRow = [
        formattedTimestamp,
        address,
        formattedZip,
        formattedName,
        durationAsSeconds(formattedFoo),
        durationAsSeconds(formattedBar),
        durationAsSeconds(formattedTotal),
        notes,
      ]
  
      this.push(formattedRow.join(',') + '\n')
    } catch (e) {
      console.warn(`Warning: row dropped due to error - ${e.message}`)
    }

    callback()
  }
})

/** FORMATTING */
const parseCSVLine = (string) => {
  let match
  const cols = []

  while ((match = CSV_PATTERN.exec(string)) !== null) {
    cols.push(match[1])
  }

  return cols
}

const formatTimestamp = (value) => {
	// Format in ISO-8601, and convert US/Pacific to US/Eastern
	const timestamp = DateTime.fromFormat(
		value,
		TIMESTAMP_FORMAT,
		{ zone: US_PACIFIC }
	)

	if (!timestamp.isValid) {
    throw new Error(INVALID_DATA_ERROR)
	}

	const easternTimestamp = timestamp.setZone(US_EASTERN)
	return easternTimestamp.toISO()
}

const formatZip = (value) => {
	value = value.padStart(5, '0')

	if (ZIP_FORMAT.test(value)) {
		return value
	}

  throw new Error(INVALID_DATA_ERROR)
}

const capitalizeString = (string) => {
	return string.split(' ').map(capitalizeWord).join(' ')
}

const capitalizeWord = s => (
	s.charAt(0).toUpperCase() + s.substring(1)
)

const formatDuration = (value) => {
	const [hours, minutes, seconds] = value.split(':')
	const [s, ms] = seconds.split('.')

	const duration = Duration.fromObject({
		hours: parseInt(hours),
		minutes: parseInt(minutes),
		seconds: parseInt(seconds),
		milliseconds: parseInt(ms)
	})

	if (!duration.isValid) {
    throw new Error(INVALID_DATA_ERROR)
	}

	return duration
}

const durationAsSeconds = duration => duration.as('seconds')

process.stdin.setEncoding('utf8')

process.stdin
  .pipe(parseCSV)
  .pipe(normalizeData)
  .pipe(process.stdout)
