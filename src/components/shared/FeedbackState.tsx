import type { ReactNode } from 'react'
import { Heading, Spinner, Stack, Text } from '@chakra-ui/react'

type FeedbackStateProps = {
  title: string
  description?: string
  kind?: 'empty' | 'error' | 'loading'
  action?: ReactNode
}

export function FeedbackState({ title, description, kind = 'empty', action }: FeedbackStateProps) {
  return (
    <Stack role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'}
      align="center" textAlign="center" gap="3" p="8">
      {kind === 'loading' && <Spinner color="primary" aria-hidden />}
      <Heading as="h2" textStyle="title-md" color={kind === 'error' ? 'fg.error' : 'fg'}>{title}</Heading>
      {description && <Text color="fg.muted" maxW="lg">{description}</Text>}
      {action}
    </Stack>
  )
}
