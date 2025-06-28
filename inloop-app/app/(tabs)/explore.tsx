import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Audio } from 'expo-av';
import axios from 'axios';

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
          const res = await axios.post("http://172.16.225.3:8000/run", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            responseType: 'arraybuffer'
          });

          console.log("1")
          // Convert arraybuffer to base64 for React Native
          const uint8Array = new Uint8Array(res.data);
          let binaryString = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
          }
          const base64Audio = btoa(binaryString);
          console.log("2")
          const soundObject = new Audio.Sound();
          console.log("3")
          await soundObject.loadAsync({ uri: `data:audio/mpeg;base64,${base64Audio}` });
          console.log("4")
          await soundObject.playAsync();
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
});
