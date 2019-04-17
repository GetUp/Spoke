import { CampaignContact } from '../models'
import request from 'request-promise-native'

/*
  Campaign contacts must be uploaded with the following custom fields:
  * nationbuilder_id: id of the campaign contact in NB
  * nationbuilder_event_ids: list of available events. It should be in the same order as event list displayed.

  The following envionment variables are also required:
  * NATIONBUILDER_API_TOKEN
  * NATIONBUILDER_SITE_SLUG
  * NATIONBUILDER_NATION
  * NATIONBUILDER_DEBUG (optional - it'll dump the output of api request stderr)
  * NATIONBUILDER_RECRUITER_ID (optional - it'll set the recruiter_id on the RSVP)

  You should then add a question that displays a list of events (likely populated from a custom field) and create
  as many question responses as the maximum number of events that can be selected. Add this handler to that question.

  The question responses should have the index of the event in the name (with the index at 1). E.g. the response 
  with name "Event 1" would reference the first event in the nationbuilder_event_ids list.

  When a question response is selected, it will find the event id for that index and attempt to RSVP this person to
  the event using the NationBuilder API. It'll write the result of the API call into the custom fields.
*/

export const displayName = () => 'NationBuilder Event RSVP'

export const instructions = () => (
  `
Contacts must be uploaded with nationbuilder_id and nationbuilder_event_ids fields.
  `
)

export async function available(organizationId) {
  return !!process.env.NATIONBUILDER_API_TOKEN
    && !!process.env.NATIONBUILDER_SITE_SLUG
    && !!process.env.NATIONBUILDER_NATION
}

export async function processAction(questionResponse, interactionStep, campaignContactId) {
  const digitMatch = questionResponse.value.match(/(\d+)/g)
  if (!digitMatch) return;
  const nation = process.env.NATIONBUILDER_NATION
  const site = process.env.NATIONBUILDER_SITE_SLUG
  const token = process.env.NATIONBUILDER_API_TOKEN
  const debug = process.env.NATIONBUILDER_DEBUG
  const recruiter_id = process.env.NATIONBUILDER_RECRUITER_ID
  const eventIndexes = digitMatch.map(match => parseInt(match, 10) - 1)
  const contact = await CampaignContact.get(campaignContactId)
  const fields = JSON.parse(contact.custom_fields)
  let status, rsvp_id, message, eventId, rsvp, params
  const nationbuilder_event_ids = typeof(fields.nationbuilder_event_ids) === 'string' ?
                                    JSON.parse(fields.nationbuilder_event_ids) :
                                    fields.nationbuilder_event_ids
  if (debug) console.error('Fields and index: ', fields, eventIndexes)
  if (fields.nationbuilder_event_ids) {
    for (let i = 0; i < eventIndexes.length; i++) {
      const eventId = nationbuilder_event_ids[eventIndexes[i]]
      try {
        const rsvp_params = { event_id: eventId , person_id: fields.nationbuilder_id }
        if (recruiter_id) rsvp_params['recruiter_id'] = recruiter_id
        const params = {
          url: `https://${nation}.nationbuilder.com/api/v1/sites/${site}/pages/events/${eventId}/rsvps`,
          qs: { access_token: token },
          json: { rsvp: rsvp_params }
        }
        if (debug) console.error('Request: ', params)
        if (debug) request.debug = true
        const rsvp = await request.post(params)
        if (debug) console.error('Success: ', rsvp)
        status = 'success'
        rsvp_id = rsvp.id
      } catch (e) {
        if (e.toString().match(/signup_id has already been taken/)) {
          status = 'success'
          message = 'already rsvped'
        } else {
          if (debug) console.error('Error: ', e)
          status = 'error'
          message = e.toString()
        }
      }
      fields['nationbuilder_rsvp_' + eventId] = { status, created_at: new Date(), rsvp_id, message }
      contact.custom_fields = JSON.stringify(fields)
      await contact.save()
    }
  }
}