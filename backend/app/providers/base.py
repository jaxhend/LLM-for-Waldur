from abc import abstractmethod, ABC
from typing import Dict, Any, AsyncGenerator


class LLMProvider(ABC):
    name: str

    @abstractmethod
    async def complete(self,
                       *,
                       messages:list[dict],
                       model:str,
                       temperature: float,
                        max_tokens: int | None,
                       stream: bool
                       ) -> Dict[str, Any]:
        """(if stream = False) returns dict with keys:
            {"model", "content", "finish_reason", "usage}
            (if stream = True) should raise NotImplementedError and uses astream()
        """
        raise NotImplementedError

    @abstractmethod
    async def astream(self,
                      *,
                      messages:list[dict],
                      model:str,
                      temperature: float,
                      max_tokens: int | None) -> AsyncGenerator[Dict[str, Any], None]:
        """Yield dict chunks with keys: {"id", "model", "delta", "done"}."""
        raise NotImplementedError
