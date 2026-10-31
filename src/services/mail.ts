import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { mailUri } from '../utils/links';

/** Opens the default mail app with everything filled in. Rejects when no app can handle mailto. */
export const openMail = (to: string, subject: string, body: string) => Linking.openURL(mailUri(to, subject, body));

/** ASSUMPTION: "Copy text" copies the body only (To and Subject are short and get typed or pasted separately). */
export const copyBody = (body: string) => Clipboard.setStringAsync(body);
