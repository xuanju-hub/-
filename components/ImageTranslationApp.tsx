'use client'

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Languages, FileDown } from "lucide-react";
import { useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApiKeyDialog } from "./ApiKeyDialog";

// 添加支持的目标语言配置
const TARGET_LANGUAGES = [
  { value: "en", label: "英语" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" }
];

export default function ImageTranslationApp() {
  const [extractedText, setExtractedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(""); // 添加图片预览状态
  const [targetLang, setTargetLang] = useState(""); // 添加目标语言状��
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = localStorage.getItem("GROQ_API_KEY")
    if (!apiKey) {
      setError("请先点击设置按钮，配置您的 GROQ API 密钥")
    }
  }, [])

  // 修改文件选择处理函数
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // 清空之前的文字和翻译结果
      setExtractedText("");
      setTranslatedText("");
      setError(null);
    }
  };

  const handleExtractText = async () => {
    const apiKey = localStorage.getItem("GROQ_API_KEY")
    if (!apiKey) {
      setError("请先设置 API 密钥")
      return
    }

    if (!selectedFile) {
      setError("请先选择图片");
      return;
    }

    // 开始处理前清空之前的翻译结果
    setTranslatedText("");
    setError(null);
    setIsProcessing(true);
    try {
      // 将File对象转换为base64字符串
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const base64Image = await base64Promise;
      
      // 检查图片大小限制(4MB)
      const sizeInBytes = atob(base64Image).length;
      if (sizeInBytes > 4 * 1024 * 1024) {
        throw new Error("图片大小超过4MB限制");
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.2-11b-vision-preview", // 使用Groq的视觉模型
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "请提取这张图片中的所有文字内容,包括标题、正文和标志性符号。请保持原有格式和段落结构。"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      setExtractedText(data.choices[0].message.content);
      setError(null);
    } catch (err) {
      console.error("OCR错误:", err);
      setError(err instanceof Error ? err.message : "文字提取失败,请重试");
      // 如果出错，也清空提取的文字
      setExtractedText("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranslate = async () => {
    const apiKey = localStorage.getItem("GROQ_API_KEY")
    if (!apiKey) {
      setError("请先设置 API 密钥")
      return
    }

    if (!extractedText || !targetLang) {
      setError("请先提取文字并选择目标语言");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,  // 使用本地存储的 API 密钥
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.2-11b-vision-preview",
          messages: [
            {
              role: "user",
              content: `请将以下文字翻译成${TARGET_LANGUAGES.find(lang => lang.value === targetLang)?.label},保持原有格式、语气和语言习惯:\n\n${extractedText}`
            }
          ],
          temperature: 0.3,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      setTranslatedText(data.choices[0].message.content);
      setError(null);
    } catch (err) {
      console.error("翻译错误:", err);
      setError(err instanceof Error ? err.message : "翻译失败,请重试");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = (format: 'txt' | 'md') => {
    const content = `原文：\n${extractedText}\n\n译文：\n${translatedText}`;
    const fileName = `translation.${format}`;
    
    // 创建 Blob 对象
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    
    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* 添加渐变紫色顶部背景 */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-4 relative">
        {/* 标题居中 */}
        <h1 className="text-2xl font-bold text-white text-center">图像智译应用</h1>
        
        {/* 设置按钮定位在右侧 */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <ApiKeyDialog />
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* 上传图像区域 */}
        <div className="space-y-2">
          <label className="text-lg font-medium">上传图像</label>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => document.getElementById('file-input')?.click()}>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <span>{selectedFile ? selectedFile.name : "未选择任何文件"}</span>
            </Button>
            <Button size="icon" variant="outline">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 提取的文字区域 */}
        <div className="space-y-2">
          <label className="text-lg font-medium">提取的文字</label>
          <Textarea 
            value={extractedText} 
            readOnly 
            placeholder="提取的文字将显示在这里..."
            className="min-h-[300px] text-base"
          />
        </div>

        {/* 目标语言选择 */}
        <div className="space-y-2">
          <label className="text-lg font-medium">目标语言</label>
          <Select value={targetLang} onValueChange={setTargetLang}>
            <SelectTrigger>
              <SelectValue placeholder="选择目标语言" />
            </SelectTrigger>
            <SelectContent>
              {TARGET_LANGUAGES.map(lang => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 翻译结果区域 */}
        <div className="space-y-2">
          <label className="text-lg font-medium">翻译结果</label>
          <Textarea 
            value={translatedText} 
            readOnly 
            placeholder="翻译结果将显示在这里..."
            className="min-h-[300px] text-base"
          />
        </div>

        {/* 操作按钮组 */}
        <div className="flex justify-between gap-4">
          <Button 
            className="flex-1 bg-purple-500 hover:bg-purple-600" 
            onClick={handleExtractText}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            提取文字
          </Button>
          <Button 
            className="flex-1 bg-blue-500 hover:bg-blue-600" 
            onClick={handleTranslate}
            disabled={isProcessing || !extractedText}
          >
            {isProcessing ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <Languages className="mr-2 h-4 w-4" />
            )}
            翻译
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={!translatedText}
              >
                <FileDown className="mr-2 h-4 w-4" />
                导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                导出为 TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>
                导出为 Markdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
} 