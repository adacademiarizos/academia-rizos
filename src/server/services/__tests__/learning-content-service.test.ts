import { AssessmentQuestionType } from '@prisma/client'
import { calculateMultipleChoiceScore, requiresManualReview } from '../learning-content-service'

describe('learning-content assessment rules', () => {
  it('grades all-multiple-choice assessments automatically', () => {
    const answers = new Map([
      ['one', { questionId: 'one', responseText: 'A' }],
      ['two', { questionId: 'two', responseText: 'wrong' }],
    ])
    expect(calculateMultipleChoiceScore([
      { id: 'one', correctAnswer: 'A' },
      { id: 'two', correctAnswer: 'B' },
    ], answers)).toBe(50)
    expect(requiresManualReview([AssessmentQuestionType.MULTIPLE_CHOICE])).toBe(false)
  })

  it.each([AssessmentQuestionType.WRITTEN, AssessmentQuestionType.PHOTO, AssessmentQuestionType.VIDEO])(
    'routes %s evidence to administrative review',
    (type) => {
      expect(requiresManualReview([AssessmentQuestionType.MULTIPLE_CHOICE, type])).toBe(true)
    }
  )
})
