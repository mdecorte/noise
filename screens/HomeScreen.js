import React from 'react'
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native'
import Expo, { Asset, Audio, FileSystem, Font, Permissions } from 'expo'
import { WebBrowser } from 'expo'

import Colors from '../constants/Colors'
import { MonoText } from '../components/StyledText'

export default class HomeScreen extends React.Component {
  constructor(props) {
    super(props)
    this.recording = null
    this.sound = null
    this.sounds = []
    this.isSeeking = false
    this.shouldPlayAtEndOfSeek = false
    this.state = {
      haveRecordingPermissions: false,
      isLoading: false,
      isPlaybackAllowed: false,
      muted: false,
      soundPosition: null,
      soundDuration: null,
      recordingDuration: null,
      shouldPlay: false,
      isPlaying: false,
      isRecording: false,
      fontLoaded: false,
      shouldCorrectPitch: true,
      volume: 1.0,
      rate: 1.0,
    }
    this.recordingSettings = JSON.parse(
      JSON.stringify(Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY)
    )
    // // UNCOMMENT THIS TO TEST maxFileSize:
    // this.recordingSettings.android['maxFileSize'] = 12000;
  }

  static navigationOptions = {
    header: null,
  }

  componentDidMount() {
    this._askForPermissions()
  }

  render() {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.welcomeContainer}>
            <Image
              source={
                this.state.isRecording
                  ? require('../assets/images/robot-dev.png')
                  : require('../assets/images/robot-prod.png')
              }
              style={styles.welcomeImage}
            />
          </View>

          <View style={styles.getStartedContainer}>
            <TouchableHighlight
              underlayColor={Colors.tintColor}
              style={styles.wrapper}
              onPress={this._onRecordPressed}
              disabled={this.state.isLoading}
            >
              <Text style={styles.getStartedText}>Record this</Text>
            </TouchableHighlight>
          </View>
          <View style={styles.getStartedContainer}>
            <View
              style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
            >
              {this.sounds.length &&
                this.sounds.map((sound, i) => this._renderSound(sound, i))}
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  _renderSound = (sound, i) => {
    return (
      <TouchableHighlight
        underlayColor={Colors.detailHardColor}
        style={styles.wrapper}
        onPress={() => this._onPlayPausePressed(i)}
        key={i}
        disabled={!this.state.isPlaybackAllowed || this.state.isLoading}
      >
        <MonoText style={styles.codeHighlightText}>
          {this.state.isPlaying ? 'playing' : 'not playing'}
        </MonoText>
      </TouchableHighlight>
    )
  }

  _updateScreenForRecordingStatus = status => {
    if (status.canRecord) {
      this.setState({
        isRecording: status.isRecording,
        recordingDuration: status.durationMillis,
      })
    } else if (status.isDoneRecording) {
      this.setState({
        isRecording: false,
        recordingDuration: status.durationMillis,
      })
      if (!this.state.isLoading) {
        this._stopRecordingAndEnablePlayback()
      }
    }
  }

  _askForPermissions = async () => {
    const response = await Permissions.askAsync(Permissions.AUDIO_RECORDING)
    this.setState({
      haveRecordingPermissions: response.status === 'granted',
    })
  }

  async _stopPlaybackAndBeginRecording() {
    this.setState({
      isLoading: true,
    })
    if (this.sound !== null) {
      await this.sound.unloadAsync()
      this.sound.setOnPlaybackStatusUpdate(null)
      this.sound = null
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: true,
    })
    if (this.recording !== null) {
      // this.recording.setOnRecordingStatusUpdate(null)
      // this.recording = null
    }

    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(this.recordingSettings)
    recording.setOnRecordingStatusUpdate(this._updateScreenForRecordingStatus)

    this.recording = recording
    await this.recording.startAsync() // Will call this._updateScreenForRecordingStatus to update the screen.
    this.setState({
      isLoading: false,
    })
  }

  async _stopRecordingAndEnablePlayback() {
    this.setState({
      isLoading: true,
    })
    try {
      await this.recording.stopAndUnloadAsync()
    } catch (error) {
      console.log(error)
      // Do nothing -- we are already unloaded.
    }
    const info = await FileSystem.getInfoAsync(this.recording.getURI())
    console.log(`FILE INFO: ${JSON.stringify(info)}`)
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      playsInSilentLockedModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
    })
    const { sound, status } = await this.recording.createNewLoadedSound(
      {
        isLooping: true,
        isMuted: this.state.muted,
        volume: this.state.volume,
        rate: this.state.rate,
        shouldCorrectPitch: this.state.shouldCorrectPitch,
      },
      this._updateScreenForSoundStatus
    )
    this.sound = sound
    console.log('called')
    this.sounds.push(this.sound)
    this.setState({
      isLoading: false,
    })
  }

  _updateScreenForSoundStatus = status => {
    if (status.isLoaded) {
      this.setState({
        soundDuration: status.durationMillis,
        soundPosition: status.positionMillis,
        shouldPlay: status.shouldPlay,
        isPlaying: status.isPlaying,
        rate: status.rate,
        muted: status.isMuted,
        volume: status.volume,
        shouldCorrectPitch: status.shouldCorrectPitch,
        isPlaybackAllowed: true,
      })
    } else {
      this.setState({
        soundDuration: null,
        soundPosition: null,
        isPlaybackAllowed: false,
      })
      if (status.error) {
        console.log(`FATAL PLAYER ERROR: ${status.error}`)
      }
    }
  }

  _onRecordPressed = () => {
    if (this.state.isRecording) {
      this._stopRecordingAndEnablePlayback()
    } else {
      this._stopPlaybackAndBeginRecording()
    }
  }

  _onPlayPausePressed = i => {
    if (this.sound != null) {
      if (this.state.isPlaying) {
        this.sound.pauseAsync()
      } else {
        this.sound = this.sounds[i]
        console.log(this.sound)
        this.sound.playAsync()
      }
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.areaMediumColor,
  },
  developmentModeText: {
    marginBottom: 20,
    color: 'rgba(0,0,0,0.4)',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  contentContainer: {
    paddingTop: 30,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  welcomeImage: {
    width: 100,
    height: 80,
    resizeMode: 'contain',
    marginTop: 3,
    marginLeft: -10,
  },
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: 7,
  },
  codeHighlightText: {
    color: 'rgba(96,100,109, 0.8)',
  },
  codeHighlightContainer: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  getStartedText: {
    fontSize: 17,
    color: 'rgba(96,100,109, 1)',
    lineHeight: 24,
    textAlign: 'center',
  },
  tabBarInfoContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      ios: {
        shadowColor: 'black',
        shadowOffset: { height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 20,
      },
    }),
    alignItems: 'center',
    backgroundColor: '#fbfbfb',
    paddingVertical: 20,
  },
  tabBarInfoText: {
    fontSize: 17,
    color: 'rgba(96,100,109, 1)',
    textAlign: 'center',
  },
  navigationFilename: {
    marginTop: 5,
  },
  helpContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: 15,
  },
  helpLinkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
})
