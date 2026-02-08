/**
 * ViralQuill — Prompt Management
 * Public API surface for prompt templates and builders.
 */

export {
  REWRITER_SYSTEM_PROMPT,
  buildRewriterMessage,
  type RewriterRequest,
  type RewriterResponse,
} from './rewriter';

export {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeMessage,
  type JudgeRequest,
  type JudgeResponse,
} from './judge';
