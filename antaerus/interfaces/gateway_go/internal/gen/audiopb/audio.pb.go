// Code generated manually to mirror protoc output in the sandbox. DO NOT EDIT.
// source: audio.proto

package audiopb

import (
	proto "google.golang.org/protobuf/proto"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	descriptorpb "google.golang.org/protobuf/types/descriptorpb"
	reflect "reflect"
	sync "sync"
)

const (
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

var File_audio_proto protoreflect.FileDescriptor

type StartVoiceSessionRequest struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	Language      string                 `protobuf:"bytes,2,opt,name=language,proto3" json:"language,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *StartVoiceSessionRequest) Reset() {
	*x = StartVoiceSessionRequest{}
	mi := &file_audio_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *StartVoiceSessionRequest) String() string { return protoimpl.X.MessageStringOf(x) }
func (*StartVoiceSessionRequest) ProtoMessage()    {}

func (x *StartVoiceSessionRequest) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*StartVoiceSessionRequest) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{0}
}

func (x *StartVoiceSessionRequest) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

func (x *StartVoiceSessionRequest) GetLanguage() string {
	if x != nil {
		return x.Language
	}
	return ""
}

type StopVoiceSessionRequest struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *StopVoiceSessionRequest) Reset() {
	*x = StopVoiceSessionRequest{}
	mi := &file_audio_proto_msgTypes[1]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *StopVoiceSessionRequest) String() string { return protoimpl.X.MessageStringOf(x) }
func (*StopVoiceSessionRequest) ProtoMessage()    {}

func (x *StopVoiceSessionRequest) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[1]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*StopVoiceSessionRequest) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{1}
}

func (x *StopVoiceSessionRequest) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

type StopVoiceSessionResponse struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	Stopped       bool                   `protobuf:"varint,2,opt,name=stopped,proto3" json:"stopped,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *StopVoiceSessionResponse) Reset() {
	*x = StopVoiceSessionResponse{}
	mi := &file_audio_proto_msgTypes[2]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *StopVoiceSessionResponse) String() string { return protoimpl.X.MessageStringOf(x) }
func (*StopVoiceSessionResponse) ProtoMessage()    {}

func (x *StopVoiceSessionResponse) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[2]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*StopVoiceSessionResponse) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{2}
}

func (x *StopVoiceSessionResponse) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

func (x *StopVoiceSessionResponse) GetStopped() bool {
	if x != nil {
		return x.Stopped
	}
	return false
}

type SpeakRequest struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	Text          string                 `protobuf:"bytes,2,opt,name=text,proto3" json:"text,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *SpeakRequest) Reset() {
	*x = SpeakRequest{}
	mi := &file_audio_proto_msgTypes[3]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *SpeakRequest) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SpeakRequest) ProtoMessage()    {}

func (x *SpeakRequest) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[3]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*SpeakRequest) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{3}
}

func (x *SpeakRequest) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

func (x *SpeakRequest) GetText() string {
	if x != nil {
		return x.Text
	}
	return ""
}

type SpeakResponse struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	Accepted      bool                   `protobuf:"varint,2,opt,name=accepted,proto3" json:"accepted,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *SpeakResponse) Reset() {
	*x = SpeakResponse{}
	mi := &file_audio_proto_msgTypes[4]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *SpeakResponse) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SpeakResponse) ProtoMessage()    {}

func (x *SpeakResponse) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[4]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*SpeakResponse) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{4}
}

func (x *SpeakResponse) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

func (x *SpeakResponse) GetAccepted() bool {
	if x != nil {
		return x.Accepted
	}
	return false
}

type VoiceEvent struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	SessionId     string                 `protobuf:"bytes,1,opt,name=session_id,json=sessionId,proto3" json:"session_id,omitempty"`
	Payload       isVoiceEvent_Payload   `protobuf_oneof:"payload"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *VoiceEvent) Reset() {
	*x = VoiceEvent{}
	mi := &file_audio_proto_msgTypes[5]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *VoiceEvent) String() string { return protoimpl.X.MessageStringOf(x) }
func (*VoiceEvent) ProtoMessage()    {}

func (x *VoiceEvent) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[5]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*VoiceEvent) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{5}
}

func (x *VoiceEvent) GetSessionId() string {
	if x != nil {
		return x.SessionId
	}
	return ""
}

func (x *VoiceEvent) GetPayload() isVoiceEvent_Payload {
	if x != nil {
		return x.Payload
	}
	return nil
}

func (x *VoiceEvent) GetVad() *VadEvent {
	if x, ok := x.GetPayload().(*VoiceEvent_Vad); ok {
		return x.Vad
	}
	return nil
}

func (x *VoiceEvent) GetTranscript() *TranscriptEvent {
	if x, ok := x.GetPayload().(*VoiceEvent_Transcript); ok {
		return x.Transcript
	}
	return nil
}

func (x *VoiceEvent) GetSystem() *SystemEvent {
	if x, ok := x.GetPayload().(*VoiceEvent_System); ok {
		return x.System
	}
	return nil
}

type isVoiceEvent_Payload interface {
	isVoiceEvent_Payload()
}

type VoiceEvent_Vad struct {
	Vad *VadEvent `protobuf:"bytes,2,opt,name=vad,proto3,oneof"`
}

type VoiceEvent_Transcript struct {
	Transcript *TranscriptEvent `protobuf:"bytes,3,opt,name=transcript,proto3,oneof"`
}

type VoiceEvent_System struct {
	System *SystemEvent `protobuf:"bytes,4,opt,name=system,proto3,oneof"`
}

func (*VoiceEvent_Vad) isVoiceEvent_Payload()        {}
func (*VoiceEvent_Transcript) isVoiceEvent_Payload() {}
func (*VoiceEvent_System) isVoiceEvent_Payload()     {}

type VadEvent struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Speaking      bool                   `protobuf:"varint,1,opt,name=speaking,proto3" json:"speaking,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *VadEvent) Reset() {
	*x = VadEvent{}
	mi := &file_audio_proto_msgTypes[6]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *VadEvent) String() string { return protoimpl.X.MessageStringOf(x) }
func (*VadEvent) ProtoMessage()    {}

func (x *VadEvent) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[6]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*VadEvent) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{6}
}

func (x *VadEvent) GetSpeaking() bool {
	if x != nil {
		return x.Speaking
	}
	return false
}

type TranscriptEvent struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Text          string                 `protobuf:"bytes,1,opt,name=text,proto3" json:"text,omitempty"`
	IsFinal       bool                   `protobuf:"varint,2,opt,name=is_final,json=isFinal,proto3" json:"is_final,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *TranscriptEvent) Reset() {
	*x = TranscriptEvent{}
	mi := &file_audio_proto_msgTypes[7]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *TranscriptEvent) String() string { return protoimpl.X.MessageStringOf(x) }
func (*TranscriptEvent) ProtoMessage()    {}

func (x *TranscriptEvent) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[7]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*TranscriptEvent) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{7}
}

func (x *TranscriptEvent) GetText() string {
	if x != nil {
		return x.Text
	}
	return ""
}

func (x *TranscriptEvent) GetIsFinal() bool {
	if x != nil {
		return x.IsFinal
	}
	return false
}

type SystemEvent struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Level         string                 `protobuf:"bytes,1,opt,name=level,proto3" json:"level,omitempty"`
	Message       string                 `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *SystemEvent) Reset() {
	*x = SystemEvent{}
	mi := &file_audio_proto_msgTypes[8]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *SystemEvent) String() string { return protoimpl.X.MessageStringOf(x) }
func (*SystemEvent) ProtoMessage()    {}

func (x *SystemEvent) ProtoReflect() protoreflect.Message {
	mi := &file_audio_proto_msgTypes[8]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

func (*SystemEvent) Descriptor() ([]byte, []int) {
	return file_audio_proto_rawDescGZIP(), []int{8}
}

func (x *SystemEvent) GetLevel() string {
	if x != nil {
		return x.Level
	}
	return ""
}

func (x *SystemEvent) GetMessage() string {
	if x != nil {
		return x.Message
	}
	return ""
}

var (
	file_audio_proto_rawDescOnce sync.Once
	file_audio_proto_rawDescData = buildAudioFileDescriptor()
)

func file_audio_proto_rawDescGZIP() []byte {
	file_audio_proto_rawDescOnce.Do(func() {
		file_audio_proto_rawDescData = protoimpl.X.CompressGZIP(file_audio_proto_rawDescData)
	})
	return file_audio_proto_rawDescData
}

var file_audio_proto_msgTypes = make([]protoimpl.MessageInfo, 9)
var file_audio_proto_goTypes = []any{
	(*StartVoiceSessionRequest)(nil), // 0: antaerus.kernel.audio.v1.StartVoiceSessionRequest
	(*StopVoiceSessionRequest)(nil),  // 1: antaerus.kernel.audio.v1.StopVoiceSessionRequest
	(*StopVoiceSessionResponse)(nil), // 2: antaerus.kernel.audio.v1.StopVoiceSessionResponse
	(*SpeakRequest)(nil),             // 3: antaerus.kernel.audio.v1.SpeakRequest
	(*SpeakResponse)(nil),            // 4: antaerus.kernel.audio.v1.SpeakResponse
	(*VoiceEvent)(nil),               // 5: antaerus.kernel.audio.v1.VoiceEvent
	(*VadEvent)(nil),                 // 6: antaerus.kernel.audio.v1.VadEvent
	(*TranscriptEvent)(nil),          // 7: antaerus.kernel.audio.v1.TranscriptEvent
	(*SystemEvent)(nil),              // 8: antaerus.kernel.audio.v1.SystemEvent
	(*VoiceEvent_Vad)(nil),           // 9: antaerus.kernel.audio.v1.VoiceEvent.vad
	(*VoiceEvent_Transcript)(nil),    // 10: antaerus.kernel.audio.v1.VoiceEvent.transcript
	(*VoiceEvent_System)(nil),        // 11: antaerus.kernel.audio.v1.VoiceEvent.system
}
var file_audio_proto_depIdxs = []int32{
	6, // 0: antaerus.kernel.audio.v1.VoiceEvent.vad:type_name -> antaerus.kernel.audio.v1.VadEvent
	7, // 1: antaerus.kernel.audio.v1.VoiceEvent.transcript:type_name -> antaerus.kernel.audio.v1.TranscriptEvent
	8, // 2: antaerus.kernel.audio.v1.VoiceEvent.system:type_name -> antaerus.kernel.audio.v1.SystemEvent
	0, // 3: antaerus.kernel.audio.v1.AudioRuntime.StartVoiceSession:input_type -> antaerus.kernel.audio.v1.StartVoiceSessionRequest
	1, // 4: antaerus.kernel.audio.v1.AudioRuntime.StopVoiceSession:input_type -> antaerus.kernel.audio.v1.StopVoiceSessionRequest
	3, // 5: antaerus.kernel.audio.v1.AudioRuntime.Speak:input_type -> antaerus.kernel.audio.v1.SpeakRequest
	5, // 6: antaerus.kernel.audio.v1.AudioRuntime.StartVoiceSession:output_type -> antaerus.kernel.audio.v1.VoiceEvent
	2, // 7: antaerus.kernel.audio.v1.AudioRuntime.StopVoiceSession:output_type -> antaerus.kernel.audio.v1.StopVoiceSessionResponse
	4, // 8: antaerus.kernel.audio.v1.AudioRuntime.Speak:output_type -> antaerus.kernel.audio.v1.SpeakResponse
	6, // [6:9] is the sub-list for method output_type
	3, // [3:6] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_audio_proto_init() }
func file_audio_proto_init() {
	if File_audio_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_audio_proto_msgTypes[0].Exporter = func(v any, i int) any {
			switch v := v.(*StartVoiceSessionRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[1].Exporter = func(v any, i int) any {
			switch v := v.(*StopVoiceSessionRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[2].Exporter = func(v any, i int) any {
			switch v := v.(*StopVoiceSessionResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[3].Exporter = func(v any, i int) any {
			switch v := v.(*SpeakRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[4].Exporter = func(v any, i int) any {
			switch v := v.(*SpeakResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[5].Exporter = func(v any, i int) any {
			switch v := v.(*VoiceEvent); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[6].Exporter = func(v any, i int) any {
			switch v := v.(*VadEvent); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[7].Exporter = func(v any, i int) any {
			switch v := v.(*TranscriptEvent); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_audio_proto_msgTypes[8].Exporter = func(v any, i int) any {
			switch v := v.(*SystemEvent); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	file_audio_proto_msgTypes[5].OneofWrappers = []any{
		(*VoiceEvent_Vad)(nil),
		(*VoiceEvent_Transcript)(nil),
		(*VoiceEvent_System)(nil),
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_audio_proto_rawDescData,
			NumEnums:      0,
			NumMessages:   9,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_audio_proto_goTypes,
		DependencyIndexes: file_audio_proto_depIdxs,
		MessageInfos:      file_audio_proto_msgTypes,
	}.Build()
	File_audio_proto = out.File
	file_audio_proto_goTypes = nil
	file_audio_proto_depIdxs = nil
}

func buildAudioFileDescriptor() []byte {
	syntax := "proto3"
	name := "audio.proto"
	pkg := "antaerus.kernel.audio.v1"
	goPackage := "antaerus/interfaces/gateway_go/internal/gen/audiopb;audiopb"
	oneofIndex := int32(0)

	file := &descriptorpb.FileDescriptorProto{
		Syntax:  proto.String(syntax),
		Name:    proto.String(name),
		Package: proto.String(pkg),
		Options: &descriptorpb.FileOptions{
			GoPackage: proto.String(goPackage),
		},
		MessageType: []*descriptorpb.DescriptorProto{
			{
				Name: proto.String("StartVoiceSessionRequest"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
					stringField(2, "language", "language"),
				},
			},
			{
				Name: proto.String("StopVoiceSessionRequest"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
				},
			},
			{
				Name: proto.String("StopVoiceSessionResponse"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
					boolField(2, "stopped", "stopped"),
				},
			},
			{
				Name: proto.String("SpeakRequest"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
					stringField(2, "text", "text"),
				},
			},
			{
				Name: proto.String("SpeakResponse"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
					boolField(2, "accepted", "accepted"),
				},
			},
			{
				Name: proto.String("VoiceEvent"),
				OneofDecl: []*descriptorpb.OneofDescriptorProto{
					{Name: proto.String("payload")},
				},
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "session_id", "sessionId"),
					messageField(2, "vad", "vad", ".antaerus.kernel.audio.v1.VadEvent", &oneofIndex),
					messageField(3, "transcript", "transcript", ".antaerus.kernel.audio.v1.TranscriptEvent", &oneofIndex),
					messageField(4, "system", "system", ".antaerus.kernel.audio.v1.SystemEvent", &oneofIndex),
				},
			},
			{
				Name: proto.String("VadEvent"),
				Field: []*descriptorpb.FieldDescriptorProto{
					boolField(1, "speaking", "speaking"),
				},
			},
			{
				Name: proto.String("TranscriptEvent"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "text", "text"),
					boolField(2, "is_final", "isFinal"),
				},
			},
			{
				Name: proto.String("SystemEvent"),
				Field: []*descriptorpb.FieldDescriptorProto{
					stringField(1, "level", "level"),
					stringField(2, "message", "message"),
				},
			},
		},
		Service: []*descriptorpb.ServiceDescriptorProto{
			{
				Name: proto.String("AudioRuntime"),
				Method: []*descriptorpb.MethodDescriptorProto{
					{
						Name:            proto.String("StartVoiceSession"),
						InputType:       proto.String(".antaerus.kernel.audio.v1.StartVoiceSessionRequest"),
						OutputType:      proto.String(".antaerus.kernel.audio.v1.VoiceEvent"),
						ServerStreaming: proto.Bool(true),
					},
					{
						Name:       proto.String("StopVoiceSession"),
						InputType:  proto.String(".antaerus.kernel.audio.v1.StopVoiceSessionRequest"),
						OutputType: proto.String(".antaerus.kernel.audio.v1.StopVoiceSessionResponse"),
					},
					{
						Name:       proto.String("Speak"),
						InputType:  proto.String(".antaerus.kernel.audio.v1.SpeakRequest"),
						OutputType: proto.String(".antaerus.kernel.audio.v1.SpeakResponse"),
					},
				},
			},
		},
	}

	raw, err := proto.Marshal(file)
	if err != nil {
		panic(err)
	}
	return raw
}

func stringField(number int32, name string, jsonName string) *descriptorpb.FieldDescriptorProto {
	label := descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL
	kind := descriptorpb.FieldDescriptorProto_TYPE_STRING
	return &descriptorpb.FieldDescriptorProto{
		Name:     proto.String(name),
		Number:   proto.Int32(number),
		Label:    &label,
		Type:     &kind,
		JsonName: proto.String(jsonName),
	}
}

func boolField(number int32, name string, jsonName string) *descriptorpb.FieldDescriptorProto {
	label := descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL
	kind := descriptorpb.FieldDescriptorProto_TYPE_BOOL
	return &descriptorpb.FieldDescriptorProto{
		Name:     proto.String(name),
		Number:   proto.Int32(number),
		Label:    &label,
		Type:     &kind,
		JsonName: proto.String(jsonName),
	}
}

func messageField(number int32, name string, jsonName string, typeName string, oneofIndex *int32) *descriptorpb.FieldDescriptorProto {
	label := descriptorpb.FieldDescriptorProto_LABEL_OPTIONAL
	kind := descriptorpb.FieldDescriptorProto_TYPE_MESSAGE
	field := &descriptorpb.FieldDescriptorProto{
		Name:     proto.String(name),
		Number:   proto.Int32(number),
		Label:    &label,
		Type:     &kind,
		TypeName: proto.String(typeName),
		JsonName: proto.String(jsonName),
	}
	if oneofIndex != nil {
		field.OneofIndex = proto.Int32(*oneofIndex)
	}
	return field
}
