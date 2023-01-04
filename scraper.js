import inquirer from 'inquirer'
import process from 'node:process'
import puppeteer from 'puppeteer'
import { google } from 'googleapis'
import moment from 'moment'
import retrieveToken from './retrieveToken.js'
import config from './config.json' assert {type: 'json'}

const {startDate} = await inquirer.prompt({
  type: 'input',
  name: 'startDate',
  message: 'Start date (YYYY-MM-DD):',
  default: moment('2022-11-27').format('YYYY-MM-DD'),
  validate: (startDate) => {
    if (!moment(startDate).isValid()) {
      return 'Please enter a valid date'
    }
    return true
  },
})

const {endDate} = await inquirer.prompt({
    type: 'input',
    name: 'endDate',
    message: 'End date (YYYY-MM-DD):',
    default: moment('2022-11-27').format('YYYY-MM-DD'),
    validate: (endDate) => {
      if (!moment(endDate).isValid()) {
        return 'Please enter a valid date!'
      }
      if (!moment(endDate).isSameOrAfter(startDate)) {
        return 'End date must be after start date!'
      }
      return true
    },
})

const auth = await retrieveToken()
const sheets = google.sheets({ version: 'v4', auth })
const START_ROW_SEARCH = 500

let sessions = await sheets.spreadsheets.values.get({
  spreadsheetId: config.spreadsheetId,
  range: 'Session Tracker!A'+START_ROW_SEARCH+':P',
})

if (!sessions.data || sessions.data.values.length === 0) {
  console.log('No data found.')
  process.exit(0)
}

const browser = await puppeteer.launch({ headless: false })

sessions = sessions.data.values
.filter(([,,,,,, sessionDate]) => moment(sessionDate, 'MM/DD/YYYY').isBetween(startDate, endDate, 'day', '[]'))

for (let i = 0; i < sessions.length; i++) {
  let [
    classCode,,
    name,
    email,,,
    sessionDate,
    sessionTimeIn,
    sessionTimeOut,
    b2bSession,,
    sessionAttendance,
    topicsCovered,
  ] = sessions[i]

  const page = await browser.newPage()
  await page.goto('https://bit.ly/tutors-eval')

  const {studentTold, rating} = await inquirer.prompt([
    {
      type: 'list',
      default: 'email',
      choices: ['yes', 'email'],
      message: 'Did you tell the student ('+name+') to fill out the eval form?',
      name: 'studentTold',
    },
    {
      type: 'list',
      default: '5',
      choices: ['1', '2', '3', '4', '5', 'No Show'],
      message: 'How would you rate your session with '+name+'?',
      name: 'rating',
    },
  ])

  // first page
  // class code section
  if (classCode.trim() === '') {
    // click Team Calendly if there is no class code
    const teamCalendlyRadio = await page.$('.AB7Lab')
    await teamCalendlyRadio.click()
  }
  else {
    // type in class code if there is one
    const classCodeInput = await page.$('.pIDwKe')
    await classCodeInput.type(classCode)
  }

  // name section
  await page.waitForTimeout(500)
  const [nameInput, emailInput] = await page.$$('.whsOnd')
  const [firstName, ...lastName]= name.split(' ')
  await nameInput.type(lastName.join(' ') + ', ' + firstName)

  // email section
  await page.waitForTimeout(500)
  await emailInput.type(email)

  // click onto next section
  await page.waitForTimeout(500)
  const nextButton = await page.$('.uArJ5e')
  await nextButton.click()

  // second page
  await page.waitForTimeout(1000)

  // grab all necessary radio inputs from the tutoring eval form
  const [
    yesStudentEvalRadio,
    emailStudentEvalRadio,
    noShowStudentEvalRadio,
    b2bYesRadio,
    b2bNoRadio,
    preWorkYesRadio,
    preWorkNoRadio,
    teachingAssistantNoRadio,,,
    noShowRadio,
    ratingOneRadio,
    ratingTwoRadio,
    ratingThreeRadio,
    ratingFourRadio,
    ratingFiveRadio,
  ] = await page.$$('div[role="radio"]')

  // grab all checkboxes from the tutoring eval form
  const [
    noShowCheckbox,
    agileMethodologyCheckbox,
    ajaxCheckbox,
    apiCheckbox,
    bootstrapCheckbox,,
    vbaCheckbox,,
    callbacksCheckbox,
    classesCheckbox,,
    cssCheckbox,
    developmentWorkflowCheckbox,,
    excelCheckbox,
    es6Checkbox,
    firebaseCheckbox,,
    gitCheckbox,,
    handlebarsCheckbox,
    herokuCheckbox,
    htmlCheckbox,,
    javascriptCheckbox,
    jqueryCheckbox,
    jsTimersCheckbox,,
    localStorageCheckbox,,
    mongodbCheckbox,
    mysqlCheckbox,
    expressCheckbox,
    nodeCheckbox,,
    pandasCheckbox,,,
    promisesCheckbox,
    pseudoCodingCheckbox,
    pythonCheckbox,
    reactCheckbox,
    sequelizeCheckbox,,
    testDrivenDevCheckbox,,,,,,,
    noMentionDropBootcampCheckbox,
  ] = await page.$$('div[role="checkbox"]')

  const [
    sessionStartHourInput,
    sessionStartMinuteInput,
    sessionEndHourInput,
    sessionEndMinuteInput,
  ] = await page.$$('input[role="combobox"]')

  const [
    ,,
    sessionStartAmPmInput,
    sessionEndAmPmInput,
  ] = await page.$$('div[role="listbox"]')

  const [
    preWorkTopicsCoveredTextarea,
    commentsConcernsTextarea,
  ] = await page.$$('textarea')

  // student eval section
  // click the appropriate radio button based on whether the student was told to fill out the eval form,
  // it was emailed to them, or they did not show up
  if (studentTold === 'yes')
    await yesStudentEvalRadio.click()
  else if (studentTold === 'email')
    await emailStudentEvalRadio.click()
  else if (sessionAttendance.trim() === 'No Show')
    await noShowStudentEvalRadio.click()

  // back to back session section
  await page.waitForTimeout(500)
  if (b2bSession.trim() === 'Y')
    await b2bYesRadio.click()
  else
    await b2bNoRadio.click()

  // session date section
  await page.waitForTimeout(500)
  const sessionDateInput = await page.$('input[type="date"]')
  sessionDateInput.type(sessionDate)

  // session start time section
  await page.waitForTimeout(500)
  const [sessionStartHour, sessionStartMinute] = sessionTimeIn.split(':')
  await sessionStartHourInput.type(sessionStartHour)
  await sessionStartMinuteInput.type(sessionStartMinute)

  // click on the am/pm dropdown
  await sessionStartAmPmInput.click()

  // session end time section
  await page.waitForTimeout(500)
  const [sessionEndHour, sessionEndMinute] = sessionTimeOut.split(':')
  await sessionEndHourInput.type(sessionEndHour)
  await sessionEndMinuteInput.type(sessionEndMinute)

  // prework session section
  await page.waitForTimeout(500)

  topicsCovered = !!topicsCovered ? topicsCovered.toLowerCase().trim() : ''
  if (topicsCovered.includes('prework'))
    await preWorkYesRadio.click()
  else
    await preWorkNoRadio.click()

  // todo: prework topics covered section

  // topics covered section
  if (sessionAttendance.trim() === 'No Show') {
    await page.waitForTimeout(500)
    await noShowCheckbox.click()
  }
  if (topicsCovered.includes('javascript') || topicsCovered.includes('js')) {
    await page.waitForTimeout(500)
    await javascriptCheckbox.click()
  }
  if (topicsCovered.includes('jquery')) {
    await page.waitForTimeout(500)
    await jqueryCheckbox.click()
  }
  if (topicsCovered.includes('node')) {
    await page.waitForTimeout(500)
    await nodeCheckbox.click()
  }
  if (topicsCovered.includes('html')) {
    await page.waitForTimeout(500)
    await htmlCheckbox.click()
  }
  if (topicsCovered.includes('css')) {
    await page.waitForTimeout(500)
    await cssCheckbox.click()
  }
  if (topicsCovered.includes('bootstrap')) {
    await page.waitForTimeout(500)
    await bootstrapCheckbox.click()
  }
  if (topicsCovered.includes('api')) {
    await page.waitForTimeout(500)
    await apiCheckbox.click()
  }
  if (topicsCovered.includes('ajax')) {
    await page.waitForTimeout(500)
    await ajaxCheckbox.click()
  }
  if (topicsCovered.includes('react')) {
    await page.waitForTimeout(500)
    await reactCheckbox.click()
  }
  if (topicsCovered.includes('express') || topicsCovered.includes('express.js') || topicsCovered.includes('expressjs')) {
    await page.waitForTimeout(500)
    await expressCheckbox.click()
  }
  if (topicsCovered.includes('es6') || topicsCovered.includes('es2015') || topicsCovered.includes('esnext')) {
    await page.waitForTimeout(500)
    await es6Checkbox.click()
  }
  if (topicsCovered.includes('mongodb') || topicsCovered.includes('mongo')) {
    await page.waitForTimeout(500)
    await mongodbCheckbox.click()
  }
  if (topicsCovered.includes('mysql') || topicsCovered.includes('sql')) {
    await page.waitForTimeout(500)
    await mysqlCheckbox.click()
  }
  if (topicsCovered.includes('sequelize') || topicsCovered.includes('sequelize.js') || topicsCovered.includes('sequelizejs')) {
    await page.waitForTimeout(500)
    await sequelizeCheckbox.click()
  }
  if (topicsCovered.includes('pandas')) {
    await page.waitForTimeout(500)
    await pandasCheckbox.click()
  }
  if (topicsCovered.includes('python')) {
    await page.waitForTimeout(500)
    await pythonCheckbox.click()
  }
  if (topicsCovered.includes('git')) {
    await page.waitForTimeout(500)
    await gitCheckbox.click()
  }
  if (topicsCovered.includes('command line') || topicsCovered.includes('terminal') || topicsCovered.includes('commandline')) {
    await page.waitForTimeout(500)
    await commandLineCheckbox.click()
  }
  if (topicsCovered.includes('vba')) {
    await page.waitForTimeout(500)
    await vbaCheckbox.click()
  }
  if (topicsCovered.includes('excel')) {
    await page.waitForTimeout(500)
    await excelCheckbox.click()
  }
  if (topicsCovered.includes('localStorage') || topicsCovered.includes('local storage') || topicsCovered.includes('localstorage')) {
    await page.waitForTimeout(500)
    await localStorageCheckbox.click()
  }
  if (topicsCovered.includes('heroku')) {
    await page.waitForTimeout(500)
    await herokuCheckbox.click()
  }
  if (topicsCovered.includes('firebase')) {
    await page.waitForTimeout(500)
    await firebaseCheckbox.click()
  }
  if (topicsCovered.includes('callback')) {
    await page.waitForTimeout(500)
    await callbacksCheckbox.click()
  }
  if (topicsCovered.includes('promise')) {
    await page.waitForTimeout(500)
    await promisesCheckbox.click()
  }
  if (topicsCovered.includes('class')) {
    await page.waitForTimeout(500)
    await classesCheckbox.click()
  }
  if (topicsCovered.includes('timer') || topicsCovered.includes('setInterval') || topicsCovered.includes('setinterval')) {
    await page.waitForTimeout(500)
    await jsTimersCheckbox.click()
  }
  if (topicsCovered.includes('handlebars') || topicsCovered.includes('handlebars.js') || topicsCovered.includes('handlebarsjs')) {
    await page.waitForTimeout(500)
    await handlebarsCheckbox.click()
  }
  if (topicsCovered.includes('pseduo code') || topicsCovered.includes('pseudocode')) {
    await page.waitForTimeout(500)
    await pseudoCodingCheckbox.click()
  }
  if (topicsCovered.includes('agile') || topicsCovered.includes('scrum')) {
    await page.waitForTimeout(500)
    await agileMethodologyCheckbox.click()
  }
  if (topicsCovered.includes('tdd') || topicsCovered.includes('test driven development') || topicsCovered.includes('test-driven development')) {
    await page.waitForTimeout(500)
    await testDrivenDevCheckbox.click()
  }
  if (topicsCovered.includes('development workflow') || topicsCovered.includes('dev workflow')) {
    await page.waitForTimeout(500)
    await devWorkflowCheckbox.click()
  }

  // ta in class section
  // not a ta in any class, so click the no radio button
  await page.waitForTimeout(500)
  await teachingAssistantNoRadio.click()

  // time spent section
  await page.waitForTimeout(500)
  // click the no show checkbox if the student did not show up
  // otherwise, click the appropriate radio button based on student's rating for tutor's opinion of
  // effort made during the session
  if (sessionAttendance.trim() === 'N')
    await noShowRadio.click()
  else if (rating === '1')
    await ratingOneRadio.click()
  else if (rating === '2')
    await ratingTwoRadio.click()
  else if (rating === '3')
    await ratingThreeRadio.click()
  else if (rating === '4')
    await ratingFourRadio.click()
  else if (rating === '5')
    await ratingFiveRadio.click()

  // boot camp drop section
  await page.waitForTimeout(500)
  // click the no radio button since it's rare that a student mentions dropping the boot camp
  // we can click the yes radio button manually if it's necessary
  await noMentionDropBootcampCheckbox.click()

  // comments and concerns section
  await page.waitForTimeout(500)
  // fill out the textarea with 'N/A' since we don't normally have comments or concerns
  await commentsConcernsTextarea.type('N/A')
}
