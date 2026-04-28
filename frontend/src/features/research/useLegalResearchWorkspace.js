import { useEffect, useState } from 'react';
import { resetChat, submitChatTurn } from '../../lib/api.js';

export function useLegalResearchWorkspace({
  bootstrap,
  selectedProviderId,
  selectedProviderConfig,
  model,
  missingApiKey,
  courtlistenerConfig
}) {
  const [transcript, setTranscript] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const notice = missingApiKey
    ? 'Add an API key in the shared provider settings before asking the model a question.'
    : '';

  useEffect(() => {
    let isCancelled = false;

    async function initializeChat() {
      if (!bootstrap || hasInitialized || !selectedProviderId) {
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const response = await resetChat({
          providerId: selectedProviderId,
          model
        });

        if (isCancelled) {
          return;
        }

        setTranscript(response.transcript);
        setStatus('Legal research chat is ready.');
        setHasInitialized(true);
      } catch (nextError) {
        if (!isCancelled) {
          setError(nextError.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    initializeChat();

    return () => {
      isCancelled = true;
    };
  }, [bootstrap, hasInitialized, model, selectedProviderId]);

  async function handleReset() {
    setError('');
    setStatus('Starting a new legal research chat...');
    setIsSubmitting(true);

    try {
      const response = await resetChat({
        providerId: selectedProviderId,
        model
      });

      setTranscript(response.transcript);
      setUserInput('');
      setStatus('Started a fresh research chat.');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!userInput.trim()) {
      return;
    }

    if (missingApiKey) {
      setError('');
      setStatus('Enter an API key to continue.');
      return;
    }

    setError('');
    setStatus('Searching CourtListener and drafting an answer...');
    setIsSubmitting(true);

    try {
      const response = await submitChatTurn({
        providerId: selectedProviderId,
        model,
        transcript,
        userInput,
        providerConfig: selectedProviderConfig,
        courtlistenerConfig
      });

      setTranscript(response.transcript);
      setUserInput('');
      setStatus('Research answer ready.');
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    transcript,
    userInput,
    setUserInput,
    status,
    error,
    notice,
    isLoading,
    isSubmitting,
    handleReset,
    handleSubmit
  };
}
