import { ChangeEvent, DragEvent, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import type { AssetKind } from '../../types/api'

const getDefaultKind = (file: File): AssetKind => file.type.startsWith('audio') ? 'audio' : file.type.startsWith('video') ? 'video' : 'image'
const getKindOptions = (file?: File): AssetKind[] => file?.type.startsWith('audio') ? ['audio'] : file?.type.startsWith('video') ? ['video', 'side_video'] : ['image', 'logo']

export function AssetUploader({ onUpload, isUploading, progress }: { onUpload: (file: File, kind: AssetKind) => Promise<boolean>; isUploading?: boolean; progress?: number }) {
	const [dragging, setDragging] = useState(false)
	const [selectedFile, setSelectedFile] = useState<File>()
	const [selectedKind, setSelectedKind] = useState<AssetKind>()
	const selectFile = (file?: File) => { if (file) { setSelectedFile(file); setSelectedKind(getDefaultKind(file)) } }
	const upload = async () => { if (selectedFile && selectedKind && await onUpload(selectedFile, selectedKind)) { setSelectedFile(undefined); setSelectedKind(undefined) } }
	const change = (event: ChangeEvent<HTMLInputElement>) => { selectFile(event.target.files?.[0]); event.target.value = '' }
	const drop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]) }
	const options = getKindOptions(selectedFile)
	return <label className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}>
		<input type="file" hidden accept="audio/*,video/*,image/*" onChange={change} />
		<CloudUpload size={22} />
		<strong>{isUploading ? `Uploading ${progress ?? 0}%` : selectedFile ? selectedFile.name : 'Drop files here'}</strong>
		{selectedFile && !isUploading && <select value={selectedKind} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedKind(event.target.value as AssetKind)} aria-label="Asset kind">{options.map((kind) => <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>)}</select>}
		{selectedFile && !isUploading ? <button type="button" className="button primary" onClick={(event) => { event.preventDefault(); void upload() }}>Upload asset</button> : <span>{isUploading ? 'Keep this tab open until it finishes' : 'or click to browse'}</span>}
		{isUploading ? <span className="upload-progress"><i style={{ width: `${progress ?? 0}%` }} /></span> : <small>Audio, video, image, logo, side video · 500 MB max</small>}
	</label>
}
