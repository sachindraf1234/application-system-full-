"""OPTIONAL private Surya v2 OCR service. Not installed/started in the 1 GB demo.

Run on a properly provisioned machine after reading Surya's MODEL_LICENSE:
  pip install -r requirements.txt
  uvicorn surya_service:app --host 127.0.0.1 --port 8501 --workers 1
Only bind localhost/private network. The Node server sends scanned pages here when
SURYA_OCR_URL=http://127.0.0.1:8501/ocr is set. It never uploads documents to
any third-party OCR API. Surya may download its model weights on first start.
"""
from __future__ import annotations
import base64
import io
from html.parser import HTMLParser
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

app = FastAPI(title='Private Surya OCR sidecar')
_manager = None
_predictor = None

class Request(BaseModel):
    images: list[str] = Field(min_length=1, max_length=5)

class StripHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.words = []
    def handle_data(self, data):
        if data.strip(): self.words.append(data.strip())
    def handle_starttag(self, tag, attrs):
        if tag in ('br','p','tr','div','li'): self.words.append('\n')

def predictor():
    global _manager, _predictor
    if _predictor is None:
        from surya.inference import SuryaInferenceManager
        from surya.recognition import RecognitionPredictor
        _manager = SuryaInferenceManager()
        _predictor = RecognitionPredictor(_manager)
    return _predictor

@app.post('/ocr')
def ocr(request: Request):
    pages = []
    for encoded in request.images:
        try:
            image_bytes = base64.b64decode(encoded.split(',', 1)[-1], validate=True)
            if len(image_bytes) > 6_000_000: raise ValueError('Page too large')
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            if image.width * image.height > 15_000_000: raise ValueError('Too many pixels')
            pages.append(image)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f'Invalid image: {exc}') from exc
    try:
        output = predictor()(pages)
        results = []
        for page in output:
            parts = []
            confidences = []
            for block in sorted(page.blocks, key=lambda b: b.reading_order or 0):
                if block.skipped or block.error: continue
                parser = StripHTML()
                parser.feed(block.html or '')
                text = ' '.join(parser.words).replace(' \n ', '\n').strip()
                if text: parts.append(text)
                if block.confidence is not None: confidences.append(float(block.confidence))
            results.append({'text':'\n'.join(parts), 'confidence':round(100 * sum(confidences)/len(confidences)) if confidences else 0})
        return {'pages':results, 'engine':'Surya v2 (private self-hosted model)'}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f'Surya inference failed: {exc}') from exc
