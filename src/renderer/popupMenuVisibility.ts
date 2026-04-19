import type { FrameData } from '../types';
import { FrameType } from '../types';

export function isCollapsedPopupMenuChild(parent: FrameData | undefined, child: FrameData | undefined): boolean {
  if (!parent || !child) return false;
  if (parent.type !== FrameType.POPUPMENU) return false;
  if (!parent.popupMenuFrameRef) return false;
  return child.name === parent.popupMenuFrameRef;
}
