import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { scheduleLocalNotification } from './notifications';

export type HomeLocation = {
  latitude: number;
  longitude: number;
  radius?: number; // meters
};

const DEFAULT_RADIUS = 100; // meters
// Extra distance required before we count the child as "left", so GPS jitter
// right at the edge of the circle doesn't fire repeated notifications.
const EXIT_BUFFER = 30; // meters
// Ignore very inaccurate GPS fixes.
const MAX_ACCURACY = 100; // meters

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Haversine distance in meters
const distanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Foreground-only "home" geofence for the child's phone.
 *
 * Works in Expo Go (no development build needed) but ONLY while the app is open
 * on screen — iOS stops delivering location updates once the app is backgrounded
 * or the phone is locked.
 *
 * - Arriving home  -> "Welcome home! You have N chores to do today."
 * - Leaving home   -> "Don't forget to do your chore!" (only if chores are left)
 */
export function useHomeGeofence(
  home: HomeLocation | null | undefined,
  incompleteChores: number
) {
  // Keep the latest chore count in a ref so the location callback never uses a stale value
  // without restarting the location watcher every time a chore changes.
  const incompleteRef = useRef(incompleteChores);
  incompleteRef.current = incompleteChores;

  // null = unknown (first fix); we set the starting state silently instead of notifying.
  const insideRef = useRef<boolean | null>(null);

  const lat = home?.latitude;
  const lon = home?.longitude;
  const radius = home?.radius ?? DEFAULT_RADIUS;

  useEffect(() => {
    if (lat == null || lon == null) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    insideRef.current = null;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          console.log('Location permission not granted — home reminders are off.');
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 15, // meters between updates
            timeInterval: 10000, // at most every 10 seconds
          },
          (loc) => {
            if (loc.coords.accuracy && loc.coords.accuracy > MAX_ACCURACY) return;

            const dist = distanceMeters(
              loc.coords.latitude,
              loc.coords.longitude,
              lat,
              lon
            );

            // First fix: just remember where the child is.
            if (insideRef.current === null) {
              insideRef.current = dist <= radius;
              return;
            }

            const count = incompleteRef.current;

            // Arrived home
            if (!insideRef.current && dist <= radius) {
              insideRef.current = true;
              scheduleLocalNotification(
                'Welcome home! 🏠',
                count > 0
                  ? `You have ${count} chore${count === 1 ? '' : 's'} to do today.`
                  : 'No chores left today — great job! 🌟'
              );
              return;
            }

            // Left home
            if (insideRef.current && dist > radius + EXIT_BUFFER) {
              insideRef.current = false;
              if (count > 0) {
                scheduleLocalNotification(
                  "Don't forget your chores! 📋",
                  `You still have ${count} chore${count === 1 ? '' : 's'} to do today.`
                );
              }
            }
          }
        );

        if (cancelled) subscription.remove();
      } catch (error) {
        console.log('Home geofence error:', error);
      }
    };

    start();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [lat, lon, radius]);
}
