import React, { Component } from 'react'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TouchableHighlight,
  View,
  Modal,
  ActivityIndicator,
  Image,
  PermissionsAndroid, SafeAreaView, Button, AppState, FlatList

} from 'react-native'

import Toast from '@remobile/react-native-toast'
import BluetoothSerial from 'react-native-bluetooth-serial'
import CallDetectorManager from 'react-native-call-detection'
import SmsListener from 'react-native-android-sms-listener'
import SmsAndroid from 'react-native-get-sms-android';

import { Buffer } from 'buffer'
import RNAndroidNotificationListener from 'react-native-android-notification-listener'
import AsyncStorage from '@react-native-async-storage/async-storage'
import styles from './App.styles.js'

global.Buffer = Buffer
const iconv = require('iconv-lite')

//Variables
var MsgToBLCMD = "S Snd:"
var MsgFromBLCMD = "H Rcv:"
var msg1 = '';

// var msg1 = 'call ';
var msg = '';
var Msg_id = undefined;
var msgToBle = '';
var dlm = '\r\n';
var phnNumb = '03244596515';

const Button1 = ({ title, onPress, style, textStyle }) =>
  <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
    <Text style={[styles.buttonText, textStyle]}>{title.toUpperCase()}</Text>
  </TouchableOpacity>


let interval = null

const Notification = ({
  time,
  app,
  title,
  titleBig,
  text,
  subText,
  summaryText,
  bigText,
  audioContentsURI,
  imageBackgroundURI,
  extraInfoText,
  icon,
  image,
}) => {
  return (
    <View style={styles.notificationWrapper}>
      <View style={styles.notification}>
        <View style={styles.imagesWrapper}>
          {!!icon && (
            <View style={styles.notificationIconWrapper}>
              <Image source={{ uri: icon }} style={styles.notificationIcon} />
            </View>
          )}
          {!!image && (
            <View style={styles.notificationImageWrapper}>
              <Image source={{ uri: image }} style={styles.notificationImage} />
            </View>
          )}
        </View>
        <View style={styles.notificationInfoWrapper}>
          <Text>{`app: ${app}`}</Text>
          <Text>{`title: ${title}`}</Text>
          <Text>{`text: ${text}`}</Text>
          {!!time && <Text>{`time: ${time}`}</Text>}
          {!!titleBig && <Text>{`titleBig: ${titleBig}`}</Text>}
          {!!subText && <Text>{`subText: ${subText}`}</Text>}
          {!!summaryText && <Text>{`summaryText: ${summaryText}`}</Text>}
          {!!bigText && <Text>{`bigText: ${bigText}`}</Text>}
          {!!audioContentsURI && <Text>{`audioContentsURI: ${audioContentsURI}`}</Text>}
          {!!imageBackgroundURI && (
            <Text>{`imageBackgroundURI: ${imageBackgroundURI}`}</Text>
          )}
          {!!extraInfoText && <Text>{`extraInfoText: ${extraInfoText}`}</Text>}
        </View>
      </View>
    </View>
  )
}


const DeviceList = ({ devices, connectedId, showConnectedIcon, onDevicePress }) =>
  <ScrollView style={styles.container}>
    <View style={styles.listContainer}>
      {devices.map((device, i) => {
        return (
          <TouchableHighlight
            underlayColor='#DDDDDD'
            key={`${device.id}_${i}`}
            style={styles.listItem} onPress={() => onDevicePress(device)}>
            <View style={{ flexDirection: 'row' }}>
              {showConnectedIcon
                ? (
                  <View style={{ width: 48, height: 48, opacity: 0.4 }}>
                    {connectedId === device.id
                      ? (
                        <Image style={{ resizeMode: 'contain', width: 24, height: 24, flex: 1 }} source={require('./images/ic_done_black_24dp.png')} />
                      ) : null}
                  </View>
                ) : null}
              <View style={{ justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold' }}>{device.name}</Text>
                <Text>{`<${device.id}>`}</Text>
              </View>
            </View>
          </TouchableHighlight>
        )
      })}
    </View>
  </ScrollView>



class BluetoothSerialExample extends Component {
  constructor(props) {
    super(props)
    this.state = {
      isEnabled: false,
      discovering: false,
      devices: [],
      unpairedDevices: [],
      connected: false,
      section: 0,
      hasPermission: false,
      lastNotification: null,
      // interval: null
      // connecting: false
    }
  }




  notify() {
    console.log('notify')
    AppState.addEventListener('change', this.handleAppStateChange)
    clearInterval(this.interval)
    this.interval = setInterval(this.handleCheckNotificationInterval, 3000)

    return () => {
      clearInterval(this.interval)
      AppState.removeEventListener('change', this.handleAppStateChange)
    }
  }


  componentDidMount() {


    this.notify()
    this.permision()
    Promise.all([
      BluetoothSerial.isEnabled(),
      BluetoothSerial.list()
    ])
      .then((values) => {
        const [isEnabled, devices] = values
        this.setState({ isEnabled, devices })
      })

    BluetoothSerial.on('bluetoothEnabled', () => Toast.showShortBottom('Bluetooth enabled'))
    BluetoothSerial.on('bluetoothDisabled', () => Toast.showShortBottom('Bluetooth disabled'))
    BluetoothSerial.on('error', (err) => console.log(`Error: ${err.message}`))
    BluetoothSerial.on('read', (data) => {
      // console.log(data.data)
      const rcvCMD = data.data.substring(0, 6)  //cmd
      const rcvMSG = data.data.substring(6) //msg
      const smsMSG = data.data.substring(6, 9)


      if (rcvCMD == "H Rcv:") { // BLE have recieved your msg
        msg = "S Ack:" + rcvMSG;
        console.log(msg);
      } else if (rcvCMD == "H Snd:") { // BLE is Sending you a new msg
        msg = "S Rcv:" + rcvMSG; // I have recived a new msg from BLE
        console.log(msg);
        // console.log(smsMSG, 'ok');
        this.write(msg)  // Sending ACK back to BLE it's msg

        if (smsMSG == 'sms') {

          this.sendSMS()
        }


      } else {
        msg = "S UKC:" + data.data; // Unknown Command
        console.log(msg);
      }

    })

    SmsListener.addListener(message => {
      // console.info(message)
      Msg_id = String(Math.floor(Math.random() * 100000))

      msg1 = message.body + ' ' + message.originatingAddress
      msgToBle = MsgToBLCMD + msg1 + ' ' + Msg_id + dlm
      console.log(msgToBle)


      this.write(msgToBle)
      // msg1 = 'call ';
    })


    BluetoothSerial.on('connectionLost', () => {
      if (this.state.device) {
        Toast.showShortBottom(`Connection to device ${this.state.device.name} has been lost`)
      }
      this.setState({ connected: false })
    })
    BluetoothSerial.withDelimiter('\r\n')
    this.callStates()
  }

  permision() {
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG)
  }




  handleOnPressPermissionButton = async () => {

    /**
     * Open the notification settings so the user
     * so the user can enable it
     */
    RNAndroidNotificationListener.requestPermission()
  }
  handleAppStateChange = async nextAppState => {

    if (nextAppState === 'active') {
      /**
       * Check the user current notification permission status
       */

      RNAndroidNotificationListener.getPermissionStatus().then(status => {
        // setHasPermission(status !== 'denied')
        if (status !== 'denied') {
          this.setState({ hasPermission: true });
        }


      })

    }
  }

  handleCheckNotificationInterval = async () => {
    const lastStoredNotification = await AsyncStorage.getItem('@lastNotification')


    if (lastStoredNotification) {
      /**
       * As the notification is a JSON string,
       * here I just parse it
       */
      // setLastNotification(JSON.parse(lastStoredNotification))
      // console.log(lastStoredNotification)
      this.setState({ lastNotification: JSON.parse(lastStoredNotification) });


    }
  }



  sendSMS() {
    console.log(phnNumb, 'YE HAY')
    SmsAndroid.autoSend(
      phnNumb,
      'On the Way',
      (fail) => {
        console.log('Failed with this error: ' + fail);
      },
      (success) => {
        console.log('SMS sent successfully');
      },
    );

  }

  callStates() {
    let callDetector = new CallDetectorManager(
      (event, number) => {
        console.log('event -> ', event + (number ? ' - ' + number : ''));
        phnNumb = number
        if (event === 'Disconnected') {
          // Do something call got disconnected
        } else if (event === 'Connected') {
          // Do something call got connected
          // This clause will only be executed for iOS
        } else if (event === 'Incoming') {

          Msg_id = String(Math.floor(Math.random() * 100000))

          msg1 = event + ' ' + number
          msgToBle = MsgToBLCMD + msg1 + ' ' + Msg_id + dlm
          console.log(msgToBle)
          this.write(msgToBle)
          // msg1 = 'call ';
          // Do something call got incoming
        } else if (event === 'Dialing') {
          // Do something call got dialing
          // This clause will only be executed for iOS
        } else if (event === 'Offhook') {
          //Device call state: Off-hook.
          // At least one call exists that is dialing,
          // active, or on hold,
          // and no calls are ringing or waiting.
          // This clause will only be executed for Android
        } else if (event === 'Missed') {
          Msg_id = String(Math.floor(Math.random() * 100000))

          msg1 = event + ' ' + number
          msgToBle = MsgToBLCMD + msg1 + ' ' + Msg_id + dlm
          console.log(msgToBle)


          this.write(msgToBle)
          // msg1 = 'call ';

        }
      },
      true, // To read the phone number of the incoming call [ANDROID]
      () => {
        // If permission got denied [ANDROID]
        // Only If you want to read incoming number
        // Default: console.error
        console.log('Permission Denied by User');
      },
      {
        title: 'Phone State Permission',
        message: 'This app needs access to your phone state',
      }
    );
  }
  /**
   * [android]
   * request enable of bluetooth from user
   */
  requestEnable() {
    BluetoothSerial.requestEnable()
      .then((res) => this.setState({ isEnabled: true }))
      .catch((err) => Toast.showShortBottom(err.message))
  }

  /**
   * [android]
   * enable bluetooth on device
   */
  enable() {
    BluetoothSerial.enable()
      .then((res) => this.setState({ isEnabled: true }))
      .catch((err) => Toast.showShortBottom(err.message))
  }

  /**
   * [android]
   * disable bluetooth on device
   */
  disable() {
    BluetoothSerial.disable()
      .then((res) => this.setState({ isEnabled: false }))
      .catch((err) => Toast.showShortBottom(err.message))
  }

  /**
   * [android]
   * toggle bluetooth
   */
  toggleBluetooth(value) {
    if (value === true) {
      this.enable()
    } else {
      this.disable()
    }
  }

  /**
   * [android]
   * Discover unpaired devices, works only in android
   */
  discoverUnpaired() {
    if (this.state.discovering) {
      return false
    } else {
      this.setState({ discovering: true })
      BluetoothSerial.discoverUnpairedDevices()
        .then((unpairedDevices) => {
          this.setState({ unpairedDevices, discovering: false })
        })
        .catch((err) => Toast.showShortBottom(err.message))
    }
  }

  /**
   * [android]
   * Discover unpaired devices, works only in android
   */
  cancelDiscovery() {
    if (this.state.discovering) {
      BluetoothSerial.cancelDiscovery()
        .then(() => {
          this.setState({ discovering: false })
        })
        .catch((err) => Toast.showShortBottom(err.message))
    }
  }

  /**
   * [android]
   * Pair device
   */
  pairDevice(device) {
    BluetoothSerial.pairDevice(device.id)
      .then((paired) => {
        if (paired) {
          Toast.showShortBottom(`Device ${device.name} paired successfully`)
          const devices = this.state.devices
          devices.push(device)
          this.setState({ devices, unpairedDevices: this.state.unpairedDevices.filter((d) => d.id !== device.id) })
        } else {
          Toast.showShortBottom(`Device ${device.name} pairing failed`)
        }
      })
      .catch((err) => Toast.showShortBottom(err.message))
  }

  /**
   * Connect to bluetooth device by id
   * @param  {Object} device
   */
  connect(device) {
    // console.log('is connectingg', this.state.connected)
    // if (!this.state.connected) {
    this.setState({ connecting: true })
    BluetoothSerial.connect(device.id)
      .then((res) => {
        // console.log('Conneccteed!!!!')
        Toast.showShortBottom(`Connected to device ${device.name}`)
        this.setState({ device, connected: true, connecting: false })
      })
      .catch((err) => Toast.showShortBottom(err.message))
    // }
    // else {
    //   console.log('Connected ha Bhae')
    // }
  }

  /**
   * Disconnect from bluetooth device
   */
  disconnect() {
    BluetoothSerial.disconnect()
      .then(() => this.setState({ connected: false }))
      .catch((err) => {
        console.log('Hello <3')
        Toast.showShortBottom(err.message)
      })
  }

  /**
   * Toggle connection when we have active device
   * @param  {Boolean} value
   */
  toggleConnect(value) {
    if (value === true && this.state.device) {
      this.connect(this.state.device)
    } else {
      this.disconnect()
    }
  }

  /**
   * Write message to device
   * @param  {String} message
   */
  write(message) {
    // message = message + dlm
    if (!this.state.connected) {
      Toast.showShortBottom('You must connect to device first')
    }
    else {
      BluetoothSerial.write(message)
        .then((res) => {
          Toast.showShortBottom('Successfuly wrote to device')
          this.setState({ connected: true })
          this.receiveDataFromDevice();
        })
        .catch((err) => Toast.showShortBottom(err.message))
    }
  }

  receiveDataFromDevice() {
    // console.log('Im from Read')
    BluetoothSerial.withDelimiter('\r\n')
  }


  onDevicePress(device) {
    if (this.state.section === 0) {
      this.connect(device)
    } else {
      this.pairDevice(device)
    }
  }

  writePackets(message, packetSize = 64) {
    const toWrite = iconv.encode(message, 'cp852')
    const writePromises = []
    const packetCount = Math.ceil(toWrite.length / packetSize)

    for (var i = 0; i < packetCount; i++) {
      const packet = new Buffer(packetSize)
      packet.fill(' ')
      toWrite.copy(packet, 0, i * packetSize, (i + 1) * packetSize)
      writePromises.push(BluetoothSerial.write(packet))
    }

    Promise.all(writePromises)
      .then((result) => {
      })
  }




  render() {
    const activeTabStyle = { borderBottomWidth: 6, borderColor: '#009688' }
    console.log('lastNotification,', this.state.lastNotification)
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Text style={styles.heading}>Bluetooth Serial Example</Text>
          {Platform.OS === 'android'
            ? (
              <View style={styles.enableInfoWrapper}>
                <Text style={{ fontSize: 12, color: '#FFFFFF' }}>
                  {this.state.isEnabled ? 'disable' : 'enable'}
                </Text>
                <Switch
                  onValueChange={this.toggleBluetooth.bind(this)}
                  value={this.state.isEnabled} />
              </View>
            ) : null}
        </View>

        {Platform.OS === 'android'
          ? (
            <View style={[styles.topBar, { justifyContent: 'center', paddingHorizontal: 0 }]}>
              <TouchableOpacity style={[styles.tab, this.state.section === 0 && activeTabStyle]} onPress={() => this.setState({ section: 0 })}>
                <Text style={{ fontSize: 14, color: '#FFFFFF' }}>PAIRED DEVICES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, this.state.section === 1 && activeTabStyle]} onPress={() => this.setState({ section: 1 })}>
                <Text style={{ fontSize: 14, color: '#FFFFFF' }}>UNPAIRED DEVICES</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        {this.state.discovering && this.state.section === 1
          ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator
                style={{ marginBottom: 15 }}
                size={60} />
              <Button
                textStyle={{ color: '#FFFFFF' }}
                style={styles.buttonRaised}
                title='Cancel Discovery'
                onPress={() => this.cancelDiscovery()} />
            </View>
          ) : (
            <DeviceList
              showConnectedIcon={this.state.section === 0}
              connectedId={this.state.device && this.state.device.id}
              devices={this.state.section === 0 ? this.state.devices : this.state.unpairedDevices}
              onDevicePress={(device) => this.onDevicePress(device)} />
          )}


        <View style={{ alignSelf: 'flex-end', height: 52 }}>
          <ScrollView
            horizontal
            contentContainerStyle={styles.fixedFooter}>
            {Platform.OS === 'android' && this.state.section === 1
              ? (
                <Button
                  title={this.state.discovering ? '... Discovering' : 'Discover devices'}
                  onPress={this.discoverUnpaired.bind(this)} />
              ) : null}
            {Platform.OS === 'android' && !this.state.isEnabled
              ? (
                <Button
                  title='Request enable'
                  onPress={() => this.requestEnable()} />
              ) : null}

            <Button
              title='Send'
              onPress={() => {

                Msg_id = String(Math.floor(Math.random() * 100000))
                msgToBle = MsgToBLCMD + msg1 + Msg_id + dlm
                console.log(msgToBle)
                this.write('S Snd:call ' + String(Math.floor(Math.random() * 100000)) + '\r\n')
                // this.sendSMS()

              }
              } />
          </ScrollView>
        </View>
        <View style={styles.buttonWrapper}>
          <Text style={[styles.permissionStatus, { color: this.state.hasPermission ? 'green' : 'red' }]}>
            {this.state.hasPermission
              ? 'Allowed to handle notifications'
              : 'NOT allowed to handle notifications'}
          </Text>
          <Button
            title='Open Configuration'
            onPress={this.handleOnPressPermissionButton}
            disabled={this.state.hasPermission}
          />
        </View>

        {/* <View style={styles.notificationsWrapper}>
          {this.state.lastNotification && !hasGroupedMessages && <Notification {...this.state.lastNotification} />}
          {this.state.lastNotification && hasGroupedMessages && (
            <FlatList
              data={this.state.lastNotification.groupedMessages}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <Notification app={this.state.lastNotification.app} {...item} />
              )}
            />
          )}
        </View> */}

      </View>
    )
  }
}


export default BluetoothSerialExample