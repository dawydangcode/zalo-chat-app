import React from 'react';
import {
  View,
  Modal,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ImageViewerModal = ({ visible, images, initialIndex, onClose }) => {
  const flatListRef = React.useRef(null);
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [scale, setScale] = React.useState(1);
  const [baseScale, setBaseScale] = React.useState(1);

  React.useEffect(() => {
    if (visible && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: initialIndex, animated: false });
    }
  }, [visible, initialIndex]);

  const onPinchGestureEvent = (event) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      setScale(baseScale * event.nativeEvent.scale);
    }
  };

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      setBaseScale(scale);
    }
  };

  const renderImage = ({ item, index }) => (
    <PinchGestureHandler
      onGestureEvent={onPinchGestureEvent}
      onHandlerStateChange={onPinchHandlerStateChange}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item }}
          style={[styles.fullScreenImage, { transform: [{ scale }] }]}
          resizeMode="contain"
        />
      </View>
    </PinchGestureHandler>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderImage}
          keyExtractor={(item, index) => `image-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.floor(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(newIndex);
            setScale(1);
            setBaseScale(1);
          }}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        <View style={styles.indexIndicator}>
          <Text style={styles.indexText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  indexIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  indexText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ImageViewerModal;