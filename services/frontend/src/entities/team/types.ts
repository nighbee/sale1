import type { User } from '../user/types';
import type { Script } from '../script/types';

export interface Team {
  id: string;
  name: string;
  description?: string;
  auto_assign: boolean;
  members?: User[];
  script?: Script;
}
