import ical, { ICalCalendarMethod } from "ical-generator";
import * as cheerio from "cheerio";
import http from "node:http";

const dateRE = /\(\d+\.\d+\.\d{4}\)/;
const dateAndLocationRE =
  /will take place in room \S* at \S* on \S* \S* 20\d\d\./;
const dateAndLocationEndRE = /20\d\d\./;

async function getLectures() {
  let lectures = [];

  const frontPage = await fetch("https://elite-se.informatik.uni-augsburg.de/");

  const html = await frontPage.text();
  const $ = cheerio.load(html);

  $(".wp-block-latest-posts__post-title").each((i, e) => {
    const node = $(e);
    const text = node.text();
    const dateIndex = text.search(dateRE);
    const dateString = text
      .substring(dateIndex + 1, text.length - 1)
      .split(".");
    const date = new Date(
      parseInt(dateString[2]),
      parseInt(dateString[1]) - 1,
      parseInt(dateString[0]),
      16
    );
    const person = text.substring(17, dateIndex - 1);
    const url = node.attr()["href"];
    lectures.push({ url: url, date: date, person: person });
  });

  return lectures;
}

function extractTime(description, fallback) {
  const dateAndLocIndex = description.search(dateAndLocationRE);

  if (dateAndLocIndex >= 0) {
    const dateAndLoc = description.substring(dateAndLocIndex + 24);
    const endIndex = dateAndLoc.search(dateAndLocationEndRE) + 5;
    const dateAndLocTrimmed = dateAndLoc.substring(0, endIndex);
    const dateString = dateAndLocTrimmed
      .substring(
        dateAndLocTrimmed.indexOf("on ") + 3,
        dateAndLocTrimmed.length - 1
      )
      .replace("st", "")
      .replace("nd", "")
      .replace("rd", "")
      .replace("th", "");
    const timeString = dateAndLocTrimmed.substring(
      dateAndLocTrimmed.indexOf("at ") + 3
    );
    const timeStringTrimmed = timeString.substring(0, timeString.indexOf(" "));
    const hours =
      parseInt(timeStringTrimmed) + (timeStringTrimmed.includes("PM") ? 12 : 0);
    let start = new Date(dateString);
    start.setHours(hours);

    if (!isNaN(start.getTime())) return start;
  }

  return fallback;
}

async function makeEvent(lecture, calendar) {
  const html = await (await fetch(lecture.url)).text();
  const $ = cheerio.load(html);

  let description = "";

  $("#content div.entry")
    .first()
    .children()
    .each((i, e) => {
      const node = $(e);

      description += node.text().trim();
      if (node[0].name == "h2") {
        description += ":";
      }
      description += "\n\n";
    });

  description = description.trim();

  description += "\n\nMore info at " + lecture.url;

  const start = extractTime(description, lecture.date);

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  calendar.createEvent({
    start: start,
    end: end,
    timezone: "Europe/Berlin",
    summary: "Ringvorlesung: " + lecture.person,
    url: lecture.url,
    description: description,
  });
}

http
  .createServer(async (req, res) => {
    const frontPage = await fetch(
      "https://elite-se.informatik.uni-augsburg.de/"
    );

    if (!frontPage.ok) {
      res.statusCode = 500;
      return;
    }

    const calendar = ical({ name: "Ringvorlesung" });
    calendar.method(ICalCalendarMethod.REQUEST);
    
    const lectures = await getLectures();

    await Promise.all(lectures.map((lecture) => makeEvent(lecture, calendar)));

    res.writeHead(200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="calendar.ics"',
    });

    res.end(calendar.toString());
  })
  .listen(process.env.PORT || 3000, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:3000");
  });
