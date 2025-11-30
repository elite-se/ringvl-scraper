import ical, { ICalCalendarMethod } from 'ical-generator'
import * as cheerio from 'cheerio'
import http from 'node:http'

const dateRE = /\(\d+\.\d+\.\d{4}\)/

http.createServer(async (req, res) => {
  const frontPage = await fetch('https://elite-se.informatik.uni-augsburg.de/')

  if (!frontPage.ok) {
    res.statusCode = 500
    return
  }

  const calendar = ical({ 'name': 'Ringvorlesung' })
  calendar.method(ICalCalendarMethod.REQUEST)

  let lectures = []

  {
    const html = await frontPage.text()
    const $ = cheerio.load(html)

    $('.wp-block-latest-posts__post-title').each((i, e) => {
      const node = $(e)
      const text = node.text()
      const dateIndex = text.search(dateRE)
      const dateString = text.substring(dateIndex + 1, text.length - 1).split('.')
      const date = new Date(parseInt(dateString[2]), parseInt(dateString[1]) - 1, parseInt(dateString[0]), 16)
      const person = text.substring(17, dateIndex - 1)
      const url = node.attr()['href']
      lectures.push({ 'url': url, 'date': date, 'person': person })
    })
  }

  for (const e of lectures) {
    const html = await fetch(e.url)
    const $ = cheerio.load(html)

    // TODO: parse stuff

    const end = new Date(e.date.getTime() + 2 * 60 * 60 * 1000)

    calendar.createEvent({
      start: e.date,
      end: end,
      timezone: 'Europe/Berlin',
      summary: 'Ringvorlesung: ' + e.person,
      url: e.url
    })
  }

  res.writeHead(200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="calendar.ics"'
  })

  res.end(calendar.toString())

}).listen(process.env.PORT || 3000, '127.0.0.1', () => {
  console.log('Server running at http://127.0.0.1:3000')
})
