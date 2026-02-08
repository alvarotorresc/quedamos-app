import { IsIn } from 'class-validator';

export class RespondEventDto {
  @IsIn(['confirmed', 'declined'])
  status: 'confirmed' | 'declined';
}
