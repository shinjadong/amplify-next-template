"use client";

import { useState, useRef } from "react";
import { Amplify } from "aws-amplify";
import { uploadData } from "aws-amplify/storage";
import "./../app/app.css";
import outputs from "../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

// JSX TypeScript 타입 정의
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// AWS Amplify 설정
Amplify.configure(outputs);

// Whisper API 엔드포인트 설정
const WHISPER_API_ENDPOINT = "https://4u4drp4v70.execute-api.ap-northeast-2.amazonaws.com/Prod/transcribe";
const STATUS_API_ENDPOINT = "https://4u4drp4v70.execute-api.ap-northeast-2.amazonaws.com/Prod/transcribe";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("ko");
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 파일 선택 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setTranscript(null);
    setError(null);
    setJobId(null);
  };

  // 언어 선택 핸들러
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value);
  };

  // 전사 요청 처리
  const handleUploadAndTranscribe = async () => {
    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // FormData 생성
      const formData = new FormData();
      formData.append('audio', file);
      
      if (language) {
        formData.append('language', language);
      }

      setIsUploading(false);
      setIsTranscribing(true);

      // Whisper API 직접 호출 - 파일을 multipart/form-data로 전송
      const response = await fetch(WHISPER_API_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      // 응답 처리
      const data = await response.json();
      
      if (response.ok) {
        setJobId(data.jobId);
        startStatusCheck(data.jobId);
      } else {
        setError(`전사 요청 실패: ${data.message || "알 수 없는 오류"}`); 
        setIsTranscribing(false);
      }

    } catch (err: any) {
      setError(`오류 발생: ${err.message || "알 수 없는 오류"}`); 
      setIsUploading(false);
      setIsTranscribing(false);
    }
  };

  // 작업 상태 확인 시작
  const startStatusCheck = (jobId: string) => {
    // 이전 인터벌이 있다면 정리
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }

    // 5초마다 상태 확인
    const interval = setInterval(() => {
      checkTranscriptionStatus(jobId);
    }, 5000);

    setStatusCheckInterval(interval);
  };

  // 전사 상태 확인
  const checkTranscriptionStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${STATUS_API_ENDPOINT}/${jobId}`, {
        method: "GET",
      });

      const data = await response.json();

      if (response.ok) {
        if (data.status === "completed") {
          setTranscript(data.transcript);
          setIsTranscribing(false);
          
          // 상태 확인 중지
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            setStatusCheckInterval(null);
          }
        } else if (data.status === "failed") {
          setError(`전사 실패: ${data.error || "알 수 없는 오류"}`);
          setIsTranscribing(false);
          
          // 상태 확인 중지
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            setStatusCheckInterval(null);
          }
        }
        // "in-progress" 상태인 경우 계속 확인
      } else {
        setError(`상태 확인 실패: ${data.message || "알 수 없는 오류"}`);
        setIsTranscribing(false);
        
        // 상태 확인 중지
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
      }
    } catch (err: any) {
      setError(`오류 발생: ${err.message || "알 수 없는 오류"}`);
      setIsTranscribing(false);
      
      // 상태 확인 중지
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
    }
  };

  // 새 전사 시작 (초기화)
  const handleNewTranscription = () => {
    setFile(null);
    setTranscript(null);
    setError(null);
    setJobId(null);
    setIsTranscribing(false);
    setIsUploading(false);
    
    // 파일 입력 필드 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="whisper-container">
      <h1>OpenAI Whisper 음성 전사 서비스</h1>
      
      {!transcript && !isTranscribing && (
        <div className="upload-section">
          <div className="form-group">
            <label htmlFor="file-upload">오디오 파일 선택:</label>
            <input 
              id="file-upload"
              type="file" 
              onChange={handleFileChange} 
              accept="audio/*" 
              ref={fileInputRef}
              disabled={isUploading || isTranscribing}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="language-select">언어 선택:</label>
            <select 
              id="language-select"
              value={language} 
              onChange={handleLanguageChange}
              disabled={isUploading || isTranscribing}
            >
              <option value="ko">한국어</option>
              <option value="en">영어</option>
              <option value="ja">일본어</option>
              <option value="zh">중국어</option>
              <option value="">자동 감지</option>
            </select>
          </div>
          
          <button 
            onClick={handleUploadAndTranscribe} 
            disabled={!file || isUploading || isTranscribing}
            className={(!file || isUploading || isTranscribing) ? "button-disabled" : ""}
          >
            {isUploading ? "업로드 중..." : isTranscribing ? "전사 중..." : "전사 시작"}
          </button>
        </div>
      )}
      
      {isTranscribing && (
        <div className="status-section">
          <div className="loading-spinner"></div>
          <p>오디오 파일을 처리하는 중입니다. 잠시만 기다려주세요...</p>
          {jobId && <p>작업 ID: {jobId}</p>}
        </div>
      )}
      
      {transcript && (
        <div className="result-section">
          <h2>전사 결과</h2>
          <div className="transcript-box">
            {transcript}
          </div>
          <button onClick={handleNewTranscription} className="new-button">새 전사 시작</button>
        </div>
      )}
      
      {error && (
        <div className="error-section">
          <p className="error-message">{error}</p>
          <button onClick={handleNewTranscription}>다시 시도</button>
        </div>
      )}
      
      <footer>
        <p>© 2025 신자동 Whisper API 서비스</p>
      </footer>
    </main>
  );
}
