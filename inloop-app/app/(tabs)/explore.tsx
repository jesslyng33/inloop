import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Audio } from 'expo-av';
import axios from 'axios';
import { useRef, useEffect, useState } from 'react';
import React from 'react';

// Custom Microphone Icon Component
const MicrophoneIcon = () => (
  <View style={styles.iconContainer}>
    {/* Microphone outline */}
    <View style={styles.microphoneOutline}>
      {/* Main body */}
      <View style={styles.microphoneBody} />
      {/* Base */}
      <View style={styles.microphoneBase} />
      {/* Stand */}
      <View style={styles.microphoneStand} />
    </View>
  </View>
);

export default function TabTwoScreen() {
  // Add a ref to track if audio is playing
  const isPlayingRef = useRef(false);
  // Add a ref for the mic monitor interv al
  const micMonitorInterval = useRef<NodeJS.Timeout | null>(null);
  // Add a ref to track the currently playing sound
  const soundRef = useRef<Audio.Sound | null>(null);
  // Threshold for detecting speech
  const MIC_THRESHOLD = -25; // dB, adjust as needed
  const podcastSoundRef = useRef<Audio.Sound | null>(null);
  const [isPodcastPlaying, setIsPodcastPlaying] = useState(false);
  // Add a ref to track podcast playing state for use in monitorMicDuringPlayback
  const isPodcastPlayingRef = useRef(isPodcastPlaying);
  const [podcastResumePosition, setPodcastResumePosition] = useState<number | null>(null);
  const [shouldResumePodcast, setShouldResumePodcast] = useState(false);
  const shouldResumePodcastRef = useRef(false);
  const podcastResumePositionRef = useRef<number | null>(null);
  const [micBaseline, setMicBaseline] = useState<number | null>(null);
  const MIC_SPIKE_DELTA = 12; // dB difference to trigger barge-in

  useEffect(() => {
    // Keep the ref in sync with the state
    isPodcastPlayingRef.current = isPodcastPlaying;
    // On mount, unload any lingering Audio.Sound instances
    (async () => {
      if (typeof soundRef !== 'undefined' && soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }
    })();
  }, [isPodcastPlaying]);

  // Function to monitor mic during playback
  const monitorMicDuringPlayback = () => {
    if (micMonitorInterval.current) clearInterval(micMonitorInterval.current);
    micMonitorInterval.current = setInterval(async () => {
      if (!isPlayingRef.current && !isPodcastPlayingRef.current) return;
      const dummyRecording = new Audio.Recording();
      try {
        await dummyRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
        await dummyRecording.startAsync();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const status = await dummyRecording.getStatusAsync();
        const metering = status.metering ?? 0;
        await dummyRecording.stopAndUnloadAsync();

        // If baseline is not set, set it and skip this interval
        if (micBaseline === null) {
          setMicBaseline(metering);
          return;
        }

        // Detect spike
        if (metering - micBaseline > MIC_SPIKE_DELTA) {
          console.log('User is speaking during playback! (barge-in detected)');
          // Stop playback
          isPlayingRef.current = false;
          if (micMonitorInterval.current) {
            clearInterval(micMonitorInterval.current);
            micMonitorInterval.current = null;
          }
          // Stop and unload the currently playing sound
          if (soundRef.current) {
            try {
              await soundRef.current.stopAsync();
              await soundRef.current.unloadAsync();
            } catch (e) {
              // Ignore errors
            }
            soundRef.current = null;
          }
          // If podcast is playing, stop and unload it, and save position for resume
          if (isPodcastPlayingRef.current && podcastSoundRef.current) {
            try {
              const status = await podcastSoundRef.current.getStatusAsync();
              if (status.isLoaded) {
                setPodcastResumePosition(status.positionMillis);
                podcastResumePositionRef.current = status.positionMillis;
                setShouldResumePodcast(true);
                shouldResumePodcastRef.current = true;
              }
              await podcastSoundRef.current.stopAsync();
              await podcastSoundRef.current.unloadAsync();
            } catch (e) {}
            podcastSoundRef.current = null;
            setIsPodcastPlaying(false);
          }
          // Call recordAndSend for barge-in
          await recordAndSend();
        }
      } catch (e) {
        // Ignore errors from dummy recording
      }
    }, 300) as unknown as NodeJS.Timeout;
  };

  // Dedicated function to play answer audio
  const playAnswerAudio = async (audioData: ArrayBuffer) => {
    // Stop mic monitoring before playing answer audio
    if (micMonitorInterval.current) {
      clearInterval(micMonitorInterval.current);
      micMonitorInterval.current = null;
    }
    isPlayingRef.current = true;
    // Convert arraybuffer to base64 for React Native
    const uint8Array = new Uint8Array(audioData);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binaryString);
    const soundObject = new Audio.Sound();
    soundRef.current = soundObject;
    await soundObject.loadAsync({ uri: `data:audio/mpeg;base64,${base64Audio}` });
    await soundObject.playAsync();
    soundObject.setOnPlaybackStatusUpdate(async (status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        isPlayingRef.current = false;
        if (micMonitorInterval.current) {
          clearInterval(micMonitorInterval.current);
          micMonitorInterval.current = null;
        }
        if (soundRef.current) {
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        // Resume podcast if needed
        if (shouldResumePodcastRef.current && podcastResumePositionRef.current !== null) {
          console.log("resuming podcast");
          setShouldResumePodcast(false);
          shouldResumePodcastRef.current = false;
          await resumePodcastFromPosition(podcastResumePositionRef.current);
          setPodcastResumePosition(null);
          podcastResumePositionRef.current = null;
        }
      }
    });
  };

  const recordAndSend = async () => {
    console.log("recordAndSend function called");
    
    try {
      // Set audio mode for iOS recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.log("Permission not granted");
        return alert("Permission denied");
      }
      
      console.log("Permission granted, starting recording");
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      console.log("Recording started");

      // Wait for 5 seconds or use a stop button
      setTimeout(async () => {
        console.log("in record function");
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (!uri) {
          alert("Failed to get recording URI");
          return;
        }

        const formData = new FormData();
        formData.append('audio', {
          uri: uri,
          name: 'audio.m4a',
          type: 'audio/m4a',
        } as any);

        console.log(uri)
        console.log(formData)

        try {
          console.log("about to post")
          const res = await axios.post("http://172.20.40.42:8000/run", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            responseType: 'arraybuffer'
          });
          console.log("1")
          console.log('Backend response:', res);
          // Extract transcript from response headers and log it
          const transcriptHeader = res.headers['transcript'] || res.headers['Transcript'] || res.headers['TRANSCRIPT'];
          if (transcriptHeader) {
            console.log('User said:', transcriptHeader);
          }
          // Use the dedicated playback function
          await playAnswerAudio(res.data);
        } catch (error) {
          console.error("Error sending audio:", error);
          alert("Failed to send audio");
        }
      }, 5000);
    } catch (error) {
      console.error("Error in recordAndSend:", error);
    }
  };

  const handleMicrophonePress = () => {
    // Handle microphone press - start recording and sending
    console.log("clicked");
    recordAndSend();
  };

  const togglePodcast = async () => {
    if (isPodcastPlaying) {
      // Stop and unload
      if (podcastSoundRef.current) {
        try {
          await podcastSoundRef.current.stopAsync();
          await podcastSoundRef.current.unloadAsync();
        } catch (e) {}
        podcastSoundRef.current = null;
      }
      setIsPodcastPlaying(false);
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(require('../../podcast.mp3'));
        await sound.setVolumeAsync(0.5); // Set volume to 50%
        podcastSoundRef.current = sound;
        setIsPodcastPlaying(true);
        // Start mic monitoring for podcast barge-in AFTER 1 second pause
        setTimeout(() => {
          monitorMicDuringPlayback();
        }, 1000);
        sound.setOnPlaybackStatusUpdate((status) => {
          if ('isLoaded' in status && status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
            setIsPodcastPlaying(false);
            podcastSoundRef.current?.unloadAsync();
            podcastSoundRef.current = null;
          }
        });
        await sound.playAsync();
      } catch (error) {
        console.error('Error playing podcast:', error);
        setIsPodcastPlaying(false);
      }
    }
  };

  // Helper to resume podcast from a given position
  const resumePodcastFromPosition = async (positionMillis: number) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(require('../../podcast.mp3'), { positionMillis });
      await sound.setVolumeAsync(0.5); // Set volume to 50%
      podcastSoundRef.current = sound;
      setIsPodcastPlaying(true);
      // Start mic monitoring for podcast barge-in AFTER 1 second pause
      setTimeout(() => {
        monitorMicDuringPlayback();
      }, 1000);
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('isLoaded' in status && status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
          setIsPodcastPlaying(false);
          podcastSoundRef.current?.unloadAsync();
          podcastSoundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch (error) {
      console.error('Error resuming podcast:', error);
      setIsPodcastPlaying(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Red microphone button at the bottom */}
      <View style={styles.microphoneContainer}>
        <TouchableOpacity 
          style={styles.microphoneButton}
          onPress={handleMicrophonePress}
          activeOpacity={0.8}
        >
          <MicrophoneIcon />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.microphoneButton, { marginTop: 20, borderColor: '#4444ff' }]}
          onPress={togglePodcast}
          activeOpacity={0.8}
        >
          <ThemedText style={{ color: '#4444ff' }}>{isPodcastPlaying ? 'Stop Podcast' : 'Podcast'}</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // White background
  },
  microphoneContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Align to bottom
    alignItems: 'center',
    paddingBottom: 100, // Space from bottom
  },
  microphoneButton: {
    backgroundColor: '#ffffff', // White background for outline effect
    width: 100,
    height: 100,
    borderRadius: 50, // Makes it circular
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ff4444', // Red border
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8, // Android shadow
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  microphoneOutline: {
    width: 30,
    height: 30,
    position: 'relative',
  },
  microphoneBody: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 14,
    height: 20,
    borderWidth: 2,
    borderColor: '#ff4444',
    borderRadius: 7,
  },
  microphoneBase: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    width: 22,
    height: 8,
    borderWidth: 2,
    borderColor: '#ff4444',
    borderRadius: 4,
  },
  microphoneStand: {
    position: 'absolute',
    bottom: 8,
    left: 13,
    width: 4,
    height: 6,
    borderWidth: 2,
    borderColor: '#ff4444',
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  podcastButton: {
    backgroundColor: '#fff',
    width: 140,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4444ff',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
