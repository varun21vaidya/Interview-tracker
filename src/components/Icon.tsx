import type { ComponentProps } from 'react';
import Feather from '@expo/vector-icons/Feather';

export type IconName = ComponentProps<typeof Feather>['name'];

/** The only icon set. Decorative: the control that holds it carries the accessible label. */
export const Icon = ({ name, size = 20, color }: { name: IconName; size?: number; color: string }) => (
  <Feather name={name} size={size} color={color} accessible={false} />
);
