const TIME_ZONE = 'Europe/Prague'

const formatter = new Intl.DateTimeFormat('en-US', {
	timeZone: TIME_ZONE,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
})

export function toPragueLocal(instant) {
	const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]))
	const date = `${parts.year}-${parts.month}-${parts.day}`
	return {
		date,
		dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay() || 7,
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
		seconds: Number(parts.second),
	}
}

export function minutesOfTime(time) {
	return time.getUTCHours() * 60 + time.getUTCMinutes()
}

export function formatMinutes(minutes) {
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
