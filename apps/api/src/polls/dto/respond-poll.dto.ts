import { IsIn } from 'class-validator';

export class RespondPollDto {
  @IsIn(['yes', 'no', 'unsure'])
  answer: 'yes' | 'no' | 'unsure';
}
