import React from 'react'
import AssignmentTexter from '../components/AssignmentTexter'
import { withRouter } from 'react-router'
import Drawer from 'material-ui/Drawer';
import RaisedButton from 'material-ui/RaisedButton';
import Badge from 'material-ui/Badge';
import MenuItem from 'material-ui/MenuItem';
import Slider from 'material-ui/Slider';
import {Tabs, Tab} from 'material-ui/Tabs';
import FontIcon from 'material-ui/FontIcon';
import SmsIcon from 'material-ui/svg-icons/notification/sms';
import SystemUpdateIcon from 'material-ui/svg-icons/notification/system-update';
import TexterTodo from './TexterTodo'
import _ from 'lodash'

import PageVisibility from 'react-page-visibility';
import socket from 'socket.io-client';

const io = socket('http://localhost:8080');/*window.BASE_URL*/

const styles = {
  headline: {
    fontSize: 24,
    paddingTop: 16,
    marginBottom: 12,
    fontWeight: 400,
  },
};

export default class TexterPredictive extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      organizationId: props.params.organizationId,
      assignmentId: props.params.assignmentId,
      currentTab: 'sendTab',
      drawerOpen: false,
      texterVisible: true,
      intensity: 0.5,
      timestamp: 'Connecting...',
      queued: '',
      sent: '',
      awaiting: ''
    };
  }

  componentDidMount() {
    this.assignmentActivityPoll();
    this.assignmentActivityPollResponse((err, data) => this.setState({ 
      timestamp: data.timestamp,
      queued: data.queued,
      sent: data.sent,
      awaiting: data.awaiting
    }));
    const { awaiting } = this.state
    if (_.toInteger(awaiting) > 0) { this.transitionToReply() }
  }

  componentDidUpdate(prevProps, prevState) {
    const { awaiting } = this.state
    if (_.toInteger(awaiting) > 0) { this.transitionToReply() }
  }

  handleTabChange = (value) => {
    this.setState({
      currentTab: value,
    });
  };
  handleVisibilityChange = (visibilityState, documentHidden) => {
    this.setState({ texterVisible: !documentHidden });
  }
  handleDrawerToggle = () => this.setState({drawerOpen: !this.state.drawerOpen});
  handleDrawerClose = () => this.setState({drawerOpen: false});
  handleIntensitySlider = (event, value) => this.setState({intensity: value});

  assignmentActivityPoll = () => {
    if (this.state.poll) return
    this.setState({
      poll: setInterval(() => {
        let { texterVisible, currentTab, assignmentId, intensity } = this.state
        io.emit('assignmentActivityPoll', {active: (texterVisible && currentTab == 'sendTab'), assignmentId, intensity});
      }, 2000/*window.PREDICTIVE_ITERATION_PERIOD*/)
    })
  }

  assignmentActivityPollResponse = (callback) => {
    io.on('assignmentActivityPollResponse', data => callback(null, data));
  }

  transitionToReply = () => {
    console.log('transitionToReply')
    const { router } = this.props
    const { organizationId, assignmentId } = this.state
    setTimeout(() => {
      router.push(`/app/${organizationId}/todos/${assignmentId}/reply/predictive`)
    }, 2000)
  }

  render() {
    const {
      organizationId,
      assignmentId,
      texterVisible, 
      drawerOpen,
      intensity,
      timestamp,
      queued,
      sent,
      awaiting
    } = this.state;
    return (
      <div>
        <h2 style={styles.headline}>Sending Messages</h2>
        <PageVisibility onChange={this.handleVisibilityChange}>
          <div>
            <div>
              {
                (texterVisible && !drawerOpen)
                  ? <p> TIMESTAMP: {timestamp} -- QUEUED: {queued} -- SENT: {sent} -- AWAITING: {awaiting} -- INTENSITY: {intensity} </p> 
                  : <p> Inactive </p> 
              }
            </div>
            <Slider
              step={0.5}
              value={intensity}
              onChange={this.handleIntensitySlider}
              sliderStyle={{selectionColor: "#00A2DF",rippleColor: "#00A2DF"}}
            />
          </div>
        </PageVisibility>
      </div>
    )
    /*return (
      <div>
        <Tabs
          value={this.state.currentTab}
          onChange={this.handleTabChange}
        >
          <Tab
            icon={<SmsIcon />}
            label="Send"
            value="sendTab"
          >
            <div>
              <h2 style={styles.headline}>Send</h2>
              <PageVisibility onChange={this.handleVisibilityChange}>
                <div>
                  <div>
                    {
                      (texterVisible && !drawerOpen)
                        ? <p> TIMESTAMP: {timestamp} -- QUEUED: {queued} -- SENT: {sent} -- AWAITING: {awaiting} -- INTENSITY: {intensity} </p> 
                        : <p> Inactive </p> 
                    }
                  </div>
                  <Slider
                    step={0.5}
                    value={intensity}
                    onChange={this.handleIntensitySlider}
                    sliderStyle={{selectionColor: "#00A2DF",rippleColor: "#00A2DF"}}
                  />
                </div>
              </PageVisibility>
            </div>
          </Tab>
          <Tab
            icon={<SystemUpdateIcon />}
            label="Respond"
            value="respondTab"
          >
            <div>
              <h2 style={styles.headline}>Respond</h2>
              <Badge
                badgeContent={10}
                secondary={true}
                badgeStyle={{top: 12, right: 12, textAlign: 'center', lineHeight: '24px'}}
              >
                <RaisedButton
                  label="Open Drawer"
                  onClick={this.handleDrawerToggle}
                />
              </Badge>
              <TexterTodo
                messageStatus='needsResponse'
                params={{organizationId, assignmentId}}
                predictive='true'
              />
              <Drawer
                docked={false}
                width={200}
                open={this.state.drawerOpen}
                onRequestChange={(open) => this.setState({drawerOpen: open})}
              >
                <MenuItem onClick={this.handleDrawerClose}>Menu Item</MenuItem>
                <MenuItem onClick={this.handleDrawerClose}>Menu Item 2</MenuItem>
              </Drawer>
            </div>
          </Tab>
        </Tabs>
      </div>
    );*/
  }
}

export default withRouter(TexterPredictive)
