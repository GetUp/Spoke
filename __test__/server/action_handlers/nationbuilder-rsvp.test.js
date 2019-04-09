import {displayName, instructions, available, processAction} from '../../../src/server/action_handlers/nationbuilder-rsvp'
import Organization from '../../../src/server/models/organization'
import Campaign from '../../../src/server/models/campaign'
import CampaignContact from '../../../src/server/models/campaign-contact'
import InteractionStep from '../../../src/server/models/interaction-step'
import QuestionResponse from '../../../src/server/models/question-response'
import nock from 'nock'

describe('nationbuilder-rsvp handler', () => {
  afterEach(() => {
    delete process.env.NATIONBUILDER_API_TOKEN
    delete process.env.NATIONBUILDER_SITE_SLUG
  })

  describe('displayName', () => {
    it('should return the name of the handler', () => {
      expect(displayName()).toMatch(/NationBuilder/)
    })
  })

  describe('instructions', () => {
    it('should mention the custom fields required', () => {
      expect(instructions()).toMatch(/nationbuilder_event_ids/)
    })
  })

  describe('available', () => {
    it('should return false', async () => {
      expect(await available()).toBeFalsy()
    })

    describe('with NATIONBUILDER_API_TOKEN and NATIONBUILDER_SITE_SLUG set', async () => {
      it('should return true', async () => {
        process.env.NATIONBUILDER_API_TOKEN = 'test'
        process.env.NATIONBUILDER_NATION = 'test'
        process.env.NATIONBUILDER_SITE_SLUG = 'test'
        expect(await available()).toBeTruthy()
      })
    })
  })

  describe('processAction', () => {
    describe('with a question response with an index that matches an event ID', () => {
      const fixtures = {}
      beforeEach(async () => {
        fixtures.site_slug = process.env.NATIONBUILDER_SITE_SLUG = 'test_site'
        fixtures.token = process.env.NATIONBUILDER_API_TOKEN = 'test_token'
        fixtures.nation = process.env.NATIONBUILDER_NATION = 'test'
        fixtures.nationbuilder_event_ids = '[1, 2]'
        fixtures.nationbuilder_id = 55 
        fixtures.organization = await Organization.save({ name: 'NationBuilder' })
        fixtures.campaign = await Campaign.save({ title: 'test', organization_id: fixtures.organization.id })
        fixtures.campaignContact = await CampaignContact.save({
          first_name: 'test',
          cell: '+12813308004',
          custom_fields: JSON.stringify({
            nationbuilder_id: fixtures.nationbuilder_id,
            nationbuilder_event_ids: fixtures.nationbuilder_event_ids
          }),
          campaign_id: fixtures.campaign.id
        })
        fixtures.interactionStep = await InteractionStep.save({
          campaign_id: fixtures.campaign.id,
          question: 'Which event can they attend?',
          script: 'Hello!! Which out of these events would you like to attend: {events}?'
        })
        fixtures.questionResponse = await QuestionResponse.save({
          campaign_contact_id: fixtures.campaignContact.id,
          interaction_step_id: fixtures.interactionStep.id,
          value: 'Event 2'
        })
      })

      describe('with two events selected', () => {
        beforeEach(async () => {
          fixtures.questionResponse = await QuestionResponse.save({
            campaign_contact_id: fixtures.campaignContact.id,
            interaction_step_id: fixtures.interactionStep.id,
            value: 'Event 1 and Event 2'
          })
        })

        it('should call the NationBuilder API', async () => {
          const rsvpApi1 = nock(`https://${fixtures.nation}.nationbuilder.com`)
            .post(`/api/v1/sites/${fixtures.site_slug}/pages/events/1/rsvps`, { rsvp: { person_id: fixtures.nationbuilder_id, event_id: 1 } } )
            .query({ access_token: fixtures.token })
            .reply(200, { rsvp: { id: 1, event_id: 1, person_id: fixtures.nationbuilder_id }})
          const rsvpApi2 = nock(`https://${fixtures.nation}.nationbuilder.com`)
            .post(`/api/v1/sites/${fixtures.site_slug}/pages/events/2/rsvps`, { rsvp: { person_id: fixtures.nationbuilder_id, event_id: 2 } } )
            .query({ access_token: fixtures.token })
            .reply(200, { rsvp: { id: 2, event_id: 2, person_id: fixtures.nationbuilder_id }})
          await processAction(fixtures.questionResponse, fixtures.interactionStep, fixtures.campaignContact.id);
          const updatedCampaignContact = await CampaignContact.get(fixtures.campaignContact.id)
          const updatedCustomFields = JSON.parse(updatedCampaignContact.custom_fields)
          expect(updatedCustomFields['nationbuilder_rsvp_1']['status']).toBe('success')
          expect(updatedCustomFields['nationbuilder_rsvp_2']['status']).toBe('success')
          expect(rsvpApi1.isDone()).toBeTruthy()
          expect(rsvpApi2.isDone()).toBeTruthy()
        })
      })

      it('should record any errors with the API', async () => {
        const rsvpApi = nock(`https://${fixtures.nation}.nationbuilder.com`)
          .post(`/api/v1/sites/${fixtures.site_slug}/pages/events/2/rsvps`, { rsvp: { person_id: fixtures.nationbuilder_id, event_id: 2 } } )
          .query({ access_token: fixtures.token })
          .reply(500, { error: 'some error' })
        await processAction(fixtures.questionResponse, fixtures.interactionStep, fixtures.campaignContact.id);
        const updatedCampaignContact = await CampaignContact.get(fixtures.campaignContact.id)
        const updatedCustomFields = JSON.parse(updatedCampaignContact.custom_fields)
        expect(updatedCustomFields['nationbuilder_rsvp_2']['status']).toBe('error')
        expect(updatedCustomFields['nationbuilder_rsvp_2']['message']).toMatch(/some error/)
        expect(rsvpApi.isDone()).toBeTruthy()
      })

      it('should ignore people already RSVPed', async () => {
        const rsvpApi = nock(`https://${fixtures.nation}.nationbuilder.com`)
          .post(`/api/v1/sites/${fixtures.site_slug}/pages/events/2/rsvps`, { rsvp: { person_id: fixtures.nationbuilder_id, event_id: 2 } } )
          .query({ access_token: fixtures.token })
          .reply(400, { validation_errors: 'signup_id has already been taken' })
        await processAction(fixtures.questionResponse, fixtures.interactionStep, fixtures.campaignContact.id);
        const updatedCampaignContact = await CampaignContact.get(fixtures.campaignContact.id)
        const updatedCustomFields = JSON.parse(updatedCampaignContact.custom_fields)
        expect(updatedCustomFields['nationbuilder_rsvp_2']['status']).toBe('success')
        expect(updatedCustomFields['nationbuilder_rsvp_2']['message']).toMatch(/already rsvped/)
        expect(rsvpApi.isDone()).toBeTruthy()
      })
    })
  })
})
