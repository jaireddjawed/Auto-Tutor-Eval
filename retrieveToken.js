import process from 'node:process'
import path from 'node:path'
import fs, { promises } from 'node:fs'
import { promisify } from 'util'
import moment from 'moment'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'

const existsFile = promisify(fs.exists)

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')
const TOKEN_PATH = path.join(process.cwd(), 'token.json')

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

/**
 * 
 * @returns 
 */

const generateToken = async () => {
  console.log('Generating new token...\n')
  const client = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES,
  })
  if (client?.credentials){
    let credentials = JSON.parse(await promises.readFile(CREDENTIALS_PATH, 'utf8'))
    credentials = credentials?.installed || credentials?.web
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: client.credentials.refresh_token,
      expiry_date: moment().add(7, 'days').unix(),
    });
    await promises.writeFile(TOKEN_PATH, payload);
  }
  return client
}

/**
 * 
 * @returns 
 */

const retrieveToken = async () => {
  const tokenExists = await existsFile(TOKEN_PATH)

  if (!tokenExists) {
    console.error('Token not found.')
    return generateToken()
  }

  const token = JSON.parse(await promises.readFile(TOKEN_PATH, 'utf8'))
  const {expiry_date} = token

  if (moment().unix() > expiry_date) {
    console.error('Token expired.')
    return generateToken()
  }

  return google.auth.fromJSON(token)
}

export default retrieveToken
