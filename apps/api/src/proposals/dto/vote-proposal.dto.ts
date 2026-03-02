import { IsIn } from 'class-validator';

export class VoteProposalDto {
  @IsIn(['yes', 'no'])
  vote: 'yes' | 'no';
}
