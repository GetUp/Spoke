import { assignmentQueuer } from './job-processes'

assignmentQueuer().catch((err) => {console.log(err)})
