const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
http.listen(8080, "127.0.0.1")

import { Assignment, r } from './models'

io.on('connection', (client) => {
  client.on('assignmentActivityPoll', async (data) => {
    let assignment = await Assignment.get(data.assignmentId)
    if (assignment && (assignment.active !== data.active || assignment.intensity !== data.intensity) ) {
      await Assignment.save({ id: data.assignmentId, active: data.active, intensity: data.intensity
    }, { conflict: 'update' }) }

    const queuedMessages = await r.knex('message')
      .where({ assignment_id: assignment.id, is_from_contact: false })
      .where('send_status', 'QUEUED')
    const sentMessages = await r.knex('message')
      .where({ assignment_id: assignment.id, is_from_contact: false })
      .whereIn('send_status', ['SENT', 'DELIVERED'])
    const messagesNeedingResponse = await r.knex('campaign_contact')
      .where({ assignment_id: assignment.id, message_status: 'needsResponse' });

    const messageAnalytics = {
      timestamp: new Date(),
      queued: queuedMessages.length,
      sent: sentMessages.length,
      awaiting: messagesNeedingResponse.length
    }
    client.emit('assignmentActivityPollResponse', messageAnalytics)
  })
})

module.exports = app
