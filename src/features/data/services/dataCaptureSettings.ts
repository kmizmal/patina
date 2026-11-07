/**
 * Which capture domains the user has turned on.
 *
 * Web activity and keyboard activity are separate consent decisions with
 * different data shapes, so they travel as one grouped object rather than as
 * two loose booleans threaded through every view outlet.
 */
export interface DataCaptureSettings {
  webActivityEnabled: boolean;
  keyboardActivityEnabled: boolean;
}
