import fs from 'fs'
import util from 'util'
import inquirer from 'inquirer'
import {google} from 'googleapis'
import {Credentials, OAuth2Client} from 'google-auth-library'

const readFile = util.promisify(fs.readFile),
  writeFile = util.promisify(fs.writeFile),
  existsFile = util.promisify(fs.exists)

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

export default (async (): Promise<void> => {
  try {
    const fileExists: boolean = await existsFile('./credentials.json')

    if (!fileExists) {
      throw new Error('Credentials file not found. Please create credentials.json file in the root directory.')
    }

    const credentials = JSON.parse(await readFile('./credentials.json', 'utf-8'))
    const {client_id, client_secret, redirect_uris: [uri]} = credentials.installed

    const oAuth2Client: OAuth2Client = new google.auth.OAuth2(client_id, client_secret, uri)
    const authURL: string = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })

    console.log('Authorize the app by visiting this url:\n', authURL)

    const {code} = await inquirer.prompt({
      type: 'input',
      message: 'Enter the code from that page here: ',
      name: 'code',
    })

    const token: Credentials = await oAuth2Client.getToken(code) as Credentials
    oAuth2Client.setCredentials(token)

    await writeFile('./token.json', JSON.stringify(token))
    console.log('Token stored in token.json.')
  } catch (error) {
    console.error(error)
  }
})
