export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "aceptaciones_legales": {
                  Row: {
                    "aceptada_en": string,"cuenta_id": string,"documento_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptada_en"?: string,"cuenta_id": string,"documento_id": string
                  }
                  Update: {
                    "aceptada_en"?: string,"cuenta_id"?: string,"documento_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aceptaciones_legales_cuenta_fk"
      columns: ["cuenta_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aceptaciones_legales_doc_fk"
      columns: ["documento_id"]
isOneToOne: false
      referencedRelation: "documentos_legales"
      referencedColumns: ["id"]
    }
                  ]
                },"altas_profesionales_diagnostico": {
                  Row: {
                    "creada_en": string,"cuenta_id": string,"detalle": NonNullable<Json>,"id": string,"resultado": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creada_en"?: string,"cuenta_id": string,"detalle"?: NonNullable<Json>,"id"?: string,"resultado": string
                  }
                  Update: {
                    "creada_en"?: string,"cuenta_id"?: string,"detalle"?: NonNullable<Json>,"id"?: string,"resultado"?: string
                  }
                  Relationships: [
                    
                  ]
                },"area_tipo_caso": {
                  Row: {
                    "area_id": string,"tipo_caso_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"tipo_caso_id": string
                  }
                  Update: {
                    "area_id"?: string,"tipo_caso_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "at_area_fk"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas_juridicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "at_tipo_fk"
      columns: ["tipo_caso_id"]
isOneToOne: false
      referencedRelation: "tipos_caso"
      referencedColumns: ["id"]
    }
                  ]
                },"areas_juridicas": {
                  Row: {
                    "activa": boolean,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"id"?: string,"nombre": string
                  }
                  Update: {
                    "activa"?: boolean,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"avisos_correo_diagnostico": {
                  Row: {
                    "creado_en": string,"detalle": string | null,"id": string,"notificacion_id": string,"resultado": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"detalle"?: string | null,"id"?: string,"notificacion_id": string,"resultado": string
                  }
                  Update: {
                    "creado_en"?: string,"detalle"?: string | null,"id"?: string,"notificacion_id"?: string,"resultado"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversaciones": {
                  Row: {
                    "habilitada_en": string,"id": string,"solicitud_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "habilitada_en"?: string,"id"?: string,"solicitud_id": string
                  }
                  Update: {
                    "habilitada_en"?: string,"id"?: string,"solicitud_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_sol_fk"
      columns: ["solicitud_id"]
isOneToOne: true
      referencedRelation: "solicitudes_contacto"
      referencedColumns: ["id"]
    }
                  ]
                },"cuentas": {
                  Row: {
                    "avisos_correo": boolean,"correo": string,"creada_en": string,"estado": Database["public"]['Enums']["estado_cuenta"],"id": string,"nombre_completo": string,"rol": Database["public"]['Enums']["rol_cuenta"],"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avisos_correo"?: boolean,"correo": string,"creada_en"?: string,"estado": Database["public"]['Enums']["estado_cuenta"],"id": string,"nombre_completo": string,"rol": Database["public"]['Enums']["rol_cuenta"],"telefono"?: string | null
                  }
                  Update: {
                    "avisos_correo"?: boolean,"correo"?: string,"creada_en"?: string,"estado"?: Database["public"]['Enums']["estado_cuenta"],"id"?: string,"nombre_completo"?: string,"rol"?: Database["public"]['Enums']["rol_cuenta"],"telefono"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"documentos_legales": {
                  Row: {
                    "id": string,"publicada_en": string,"referencia_contenido": string,"tipo": Database["public"]['Enums']["tipo_doc_legal"],"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"publicada_en"?: string,"referencia_contenido": string,"tipo": Database["public"]['Enums']["tipo_doc_legal"],"version": string
                  }
                  Update: {
                    "id"?: string,"publicada_en"?: string,"referencia_contenido"?: string,"tipo"?: Database["public"]['Enums']["tipo_doc_legal"],"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"evidencias_privadas": {
                  Row: {
                    "aportada_en": string,"id": string,"retener_hasta": string | null,"ruta_storage_privada": string,"tipo": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aportada_en"?: string,"id"?: string,"retener_hasta"?: string | null,"ruta_storage_privada": string,"tipo": string,"version_id": string
                  }
                  Update: {
                    "aportada_en"?: string,"id"?: string,"retener_hasta"?: string | null,"ruta_storage_privada"?: string,"tipo"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evid_version_fk"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "versiones_profesionales"
      referencedColumns: ["id"]
    }
                  ]
                },"mensajes_texto": {
                  Row: {
                    "autor_id": string,"contenido": string,"conversacion_id": string,"enviado_en": string,"id": string,"retener_hasta": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id": string,"contenido": string,"conversacion_id": string,"enviado_en"?: string,"id"?: string,"retener_hasta"?: string | null
                  }
                  Update: {
                    "autor_id"?: string,"contenido"?: string,"conversacion_id"?: string,"enviado_en"?: string,"id"?: string,"retener_hasta"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "msg_autor_fk"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "msg_chat_fk"
      columns: ["conversacion_id"]
isOneToOne: false
      referencedRelation: "conversaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"notificaciones": {
                  Row: {
                    "creada_en": string,"destinatario_id": string,"estado_aviso_correo": Database["public"]['Enums']["estado_envio_correo"],"evento": Database["public"]['Enums']["evento_noti"],"id": string,"leida_en": string | null,"mensaje_id": string | null,"revision_id": string | null,"solicitud_contacto_id": string | null,"solicitud_privacidad_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creada_en"?: string,"destinatario_id": string,"estado_aviso_correo"?: Database["public"]['Enums']["estado_envio_correo"],"evento": Database["public"]['Enums']["evento_noti"],"id"?: string,"leida_en"?: string | null,"mensaje_id"?: string | null,"revision_id"?: string | null,"solicitud_contacto_id"?: string | null,"solicitud_privacidad_id"?: string | null
                  }
                  Update: {
                    "creada_en"?: string,"destinatario_id"?: string,"estado_aviso_correo"?: Database["public"]['Enums']["estado_envio_correo"],"evento"?: Database["public"]['Enums']["evento_noti"],"id"?: string,"leida_en"?: string | null,"mensaje_id"?: string | null,"revision_id"?: string | null,"solicitud_contacto_id"?: string | null,"solicitud_privacidad_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "noti_dest_fk"
      columns: ["destinatario_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "noti_msg_fk"
      columns: ["mensaje_id"]
isOneToOne: false
      referencedRelation: "mensajes_texto"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "noti_priv_fk"
      columns: ["solicitud_privacidad_id"]
isOneToOne: false
      referencedRelation: "solicitudes_privacidad"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "noti_rev_fk"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "revisiones_profesionales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "noti_sol_fk"
      columns: ["solicitud_contacto_id"]
isOneToOne: false
      referencedRelation: "solicitudes_contacto"
      referencedColumns: ["id"]
    }
                  ]
                },"orientaciones": {
                  Row: {
                    "area_id": string | null,"comentario_general": string | null,"creada_en": string,"solicitud_id": string,"tipo_caso_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"comentario_general"?: string | null,"creada_en"?: string,"solicitud_id": string,"tipo_caso_id"?: string | null
                  }
                  Update: {
                    "area_id"?: string | null,"comentario_general"?: string | null,"creada_en"?: string,"solicitud_id"?: string,"tipo_caso_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ori_area_fk"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas_juridicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ori_sol_fk"
      columns: ["solicitud_id"]
isOneToOne: true
      referencedRelation: "solicitudes_contacto"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ori_tipo_fk"
      columns: ["tipo_caso_id"]
isOneToOne: false
      referencedRelation: "tipos_caso"
      referencedColumns: ["id"]
    }
                  ]
                },"perfil_area": {
                  Row: {
                    "area_id": string,"perfil_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"perfil_id": string
                  }
                  Update: {
                    "area_id"?: string,"perfil_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pa_area_fk"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas_juridicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pa_perfil_fk"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfiles_abogados"
      referencedColumns: ["id"]
    }
                  ]
                },"perfil_tipo_caso": {
                  Row: {
                    "perfil_id": string,"tipo_caso_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "perfil_id": string,"tipo_caso_id": string
                  }
                  Update: {
                    "perfil_id"?: string,"tipo_caso_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pt_perfil_fk"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfiles_abogados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_tipo_fk"
      columns: ["tipo_caso_id"]
isOneToOne: false
      referencedRelation: "tipos_caso"
      referencedColumns: ["id"]
    }
                  ]
                },"perfiles_abogados": {
                  Row: {
                    "activo": boolean,"alcance_verificacion_vigente": string | null,"campos_opcionales_publicos": NonNullable<Json>,"ciudad_atencion": string,"cuenta_id": string,"descripcion": string,"experiencia_anios": number,"fecha_verificacion_vigente": string | null,"formacion_declarada": string | null,"foto_publica": string | null,"horarios": string | null,"id": string,"medios_contacto": Json | null,"modalidad": string | null,"motivo_suspension": string | null,"nombre_profesional": string,"suspendido_en": string | null,"tarifas_orientativas": string | null,"version_aprobada_id": string | null,"visibilidad": Database["public"]['Enums']["visibilidad_perfil"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alcance_verificacion_vigente"?: string | null,"campos_opcionales_publicos"?: NonNullable<Json>,"ciudad_atencion": string,"cuenta_id": string,"descripcion": string,"experiencia_anios": number,"fecha_verificacion_vigente"?: string | null,"formacion_declarada"?: string | null,"foto_publica"?: string | null,"horarios"?: string | null,"id"?: string,"medios_contacto"?: Json | null,"modalidad"?: string | null,"motivo_suspension"?: string | null,"nombre_profesional": string,"suspendido_en"?: string | null,"tarifas_orientativas"?: string | null,"version_aprobada_id"?: string | null,"visibilidad"?: Database["public"]['Enums']["visibilidad_perfil"]
                  }
                  Update: {
                    "activo"?: boolean,"alcance_verificacion_vigente"?: string | null,"campos_opcionales_publicos"?: NonNullable<Json>,"ciudad_atencion"?: string,"cuenta_id"?: string,"descripcion"?: string,"experiencia_anios"?: number,"fecha_verificacion_vigente"?: string | null,"formacion_declarada"?: string | null,"foto_publica"?: string | null,"horarios"?: string | null,"id"?: string,"medios_contacto"?: Json | null,"modalidad"?: string | null,"motivo_suspension"?: string | null,"nombre_profesional"?: string,"suspendido_en"?: string | null,"tarifas_orientativas"?: string | null,"version_aprobada_id"?: string | null,"visibilidad"?: Database["public"]['Enums']["visibilidad_perfil"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfil_cuenta_fk"
      columns: ["cuenta_id"]
isOneToOne: true
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfil_version_aprobada_fk"
      columns: ["id","version_aprobada_id"]
isOneToOne: false
      referencedRelation: "versiones_profesionales"
      referencedColumns: ["perfil_id","id"]
    }
                  ]
                },"politica_revalidacion": {
                  Row: {
                    "configurada_por": string,"id": string,"periodicidad_dias": number,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "configurada_por": string,"id"?: string,"periodicidad_dias": number,"vigente_desde"?: string
                  }
                  Update: {
                    "configurada_por"?: string,"id"?: string,"periodicidad_dias"?: number,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pol_rev_config_fk"
      columns: ["configurada_por"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    }
                  ]
                },"revisiones_profesionales": {
                  Row: {
                    "alcance": string | null,"consultada_en": string | null,"decidida_en": string | null,"decision": string | null,"estado": Database["public"]['Enums']["estado_revision_prof"],"fuente_oficial": string | null,"id": string,"motivo": string | null,"programada_en": string | null,"proxima_revision": string | null,"responsable_id": string | null,"resultado_consulta": string | null,"tipo": Database["public"]['Enums']["tipo_revision_prof"],"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alcance"?: string | null,"consultada_en"?: string | null,"decidida_en"?: string | null,"decision"?: string | null,"estado"?: Database["public"]['Enums']["estado_revision_prof"],"fuente_oficial"?: string | null,"id"?: string,"motivo"?: string | null,"programada_en"?: string | null,"proxima_revision"?: string | null,"responsable_id"?: string | null,"resultado_consulta"?: string | null,"tipo": Database["public"]['Enums']["tipo_revision_prof"],"version_id": string
                  }
                  Update: {
                    "alcance"?: string | null,"consultada_en"?: string | null,"decidida_en"?: string | null,"decision"?: string | null,"estado"?: Database["public"]['Enums']["estado_revision_prof"],"fuente_oficial"?: string | null,"id"?: string,"motivo"?: string | null,"programada_en"?: string | null,"proxima_revision"?: string | null,"responsable_id"?: string | null,"resultado_consulta"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_revision_prof"],"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rev_responsable_fk"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rev_version_fk"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "versiones_profesionales"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitudes_contacto": {
                  Row: {
                    "abogado_perfil_id": string,"ayuda_buscada": string,"cancelada_en": string | null,"ciudadano_id": string,"clasificacion_al_enviar": NonNullable<Json>,"decidida_en": string | null,"descripcion_breve": string,"enviada_en": string,"estado": Database["public"]['Enums']["estado_solicitud"],"id": string,"motivo_rechazo": string | null,"sin_clasificar": boolean,"tipo_caso_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abogado_perfil_id": string,"ayuda_buscada": string,"cancelada_en"?: string | null,"ciudadano_id": string,"clasificacion_al_enviar": NonNullable<Json>,"decidida_en"?: string | null,"descripcion_breve": string,"enviada_en"?: string,"estado"?: Database["public"]['Enums']["estado_solicitud"],"id"?: string,"motivo_rechazo"?: string | null,"sin_clasificar": boolean,"tipo_caso_id"?: string | null
                  }
                  Update: {
                    "abogado_perfil_id"?: string,"ayuda_buscada"?: string,"cancelada_en"?: string | null,"ciudadano_id"?: string,"clasificacion_al_enviar"?: NonNullable<Json>,"decidida_en"?: string | null,"descripcion_breve"?: string,"enviada_en"?: string,"estado"?: Database["public"]['Enums']["estado_solicitud"],"id"?: string,"motivo_rechazo"?: string | null,"sin_clasificar"?: boolean,"tipo_caso_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sol_abo_fk"
      columns: ["abogado_perfil_id"]
isOneToOne: false
      referencedRelation: "perfiles_abogados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sol_ciu_fk"
      columns: ["ciudadano_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sol_tipo_fk"
      columns: ["tipo_caso_id"]
isOneToOne: false
      referencedRelation: "tipos_caso"
      referencedColumns: ["id"]
    }
                  ]
                },"solicitudes_privacidad": {
                  Row: {
                    "estado": Database["public"]['Enums']["estado_peticion_priv"],"id": string,"medidas_aplicadas": string | null,"responsable_id": string | null,"respuesta": string | null,"resuelta_en": string | null,"solicitada_en": string,"tipo": Database["public"]['Enums']["tipo_peticion_priv"],"titular_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "estado"?: Database["public"]['Enums']["estado_peticion_priv"],"id"?: string,"medidas_aplicadas"?: string | null,"responsable_id"?: string | null,"respuesta"?: string | null,"resuelta_en"?: string | null,"solicitada_en"?: string,"tipo": Database["public"]['Enums']["tipo_peticion_priv"],"titular_id": string
                  }
                  Update: {
                    "estado"?: Database["public"]['Enums']["estado_peticion_priv"],"id"?: string,"medidas_aplicadas"?: string | null,"responsable_id"?: string | null,"respuesta"?: string | null,"resuelta_en"?: string | null,"solicitada_en"?: string,"tipo"?: Database["public"]['Enums']["tipo_peticion_priv"],"titular_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sol_priv_responsable_fk"
      columns: ["responsable_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sol_priv_titular_fk"
      columns: ["titular_id"]
isOneToOne: false
      referencedRelation: "cuentas"
      referencedColumns: ["id"]
    }
                  ]
                },"termino_area": {
                  Row: {
                    "area_id": string,"termino_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"termino_id": string
                  }
                  Update: {
                    "area_id"?: string,"termino_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ta_area_fk"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas_juridicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ta_term_fk"
      columns: ["termino_id"]
isOneToOne: false
      referencedRelation: "terminos_busqueda"
      referencedColumns: ["id"]
    }
                  ]
                },"termino_tipo_caso": {
                  Row: {
                    "termino_id": string,"tipo_caso_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "termino_id": string,"tipo_caso_id": string
                  }
                  Update: {
                    "termino_id"?: string,"tipo_caso_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tt_term_fk"
      columns: ["termino_id"]
isOneToOne: false
      referencedRelation: "terminos_busqueda"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tt_tipo_fk"
      columns: ["tipo_caso_id"]
isOneToOne: false
      referencedRelation: "tipos_caso"
      referencedColumns: ["id"]
    }
                  ]
                },"terminos_busqueda": {
                  Row: {
                    "activo": boolean,"id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"id"?: string,"texto": string
                  }
                  Update: {
                    "activo"?: boolean,"id"?: string,"texto"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tipos_caso": {
                  Row: {
                    "activo": boolean,"id": string,"nombre_cotidiano": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"id"?: string,"nombre_cotidiano": string
                  }
                  Update: {
                    "activo"?: boolean,"id"?: string,"nombre_cotidiano"?: string
                  }
                  Relationships: [
                    
                  ]
                },"versiones_profesionales": {
                  Row: {
                    "estado_revision": Database["public"]['Enums']["estado_revision_prof"],"id": string,"identificacion_privada": string,"numero_version": number,"perfil_id": string,"presentada_en": string,"tarjeta_profesional": string
                  }
                  ComputedFields: never
                  Insert: {
                    "estado_revision"?: Database["public"]['Enums']["estado_revision_prof"],"id"?: string,"identificacion_privada": string,"numero_version": number,"perfil_id": string,"presentada_en"?: string,"tarjeta_profesional": string
                  }
                  Update: {
                    "estado_revision"?: Database["public"]['Enums']["estado_revision_prof"],"id"?: string,"identificacion_privada"?: string,"numero_version"?: number,"perfil_id"?: string,"presentada_en"?: string,"tarjeta_profesional"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vers_prof_perfil_fk"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfiles_abogados"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "vista_indicadores_catalogo": {
                  Row: {
                    "categoria": string | null,"elemento": string | null,"esta_activo": boolean | null,"total_perfiles_ofrecen": number | null,"total_solicitudes_orientadas": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vista_indicadores_cuentas": {
                  Row: {
                    "estado": Database["public"]['Enums']["estado_cuenta"] | null,"rol": Database["public"]['Enums']["rol_cuenta"] | null,"total_cuentas": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vista_indicadores_perfiles": {
                  Row: {
                    "activo": boolean | null,"estado_verificacion": string | null,"total_perfiles": number | null,"visibilidad": Database["public"]['Enums']["visibilidad_perfil"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vista_indicadores_solicitudes": {
                  Row: {
                    "estado": Database["public"]['Enums']["estado_solicitud"] | null,"sin_clasificar": boolean | null,"total_solicitudes": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "buscar_abogados":
{ Args: { "p_areas"?: (string)[],"p_busqueda"?: string,"p_ciudad"?: string,"p_perfil_id"?: string,"p_tipos_caso"?: (string)[] }; Returns: {
              "alcance_verificacion_vigente": string,"areas": Json,"campos_opcionales_publicos": Json,"ciudad_atencion": string,"descripcion": string,"experiencia_anios": number,"fecha_verificacion_vigente": string,"formacion_declarada": string,"foto_publica": string,"horarios": string,"medios_contacto": Json,"modalidad": string,"nombre_profesional": string,"perfil_id": string,"tarifas_orientativas": string,"tipos_caso": Json
            }[]
                           },
"cambiar_estado_solicitud":
{ Args: { "p_motivo_rechazo"?: string,"p_nuevo_estado": Database["public"]['Enums']["estado_solicitud"],"p_solicitud_id": string }; Returns: undefined
                           },
"crear_perfil_profesional_desde_metadatos":
{ Args: { "p_cuenta_id": string,"p_perfil": Json }; Returns: string
                           },
"ejecutar_revalidacion_periodica":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"es_dueno_perfil":
{ Args: { "p_perfil_id": string }; Returns: boolean
                           },
"es_participante_solicitud":
{ Args: { "p_solicitud_id": string }; Returns: boolean
                           },
"guardar_datos_practica":
{ Args: { "p_areas": (string)[],"p_datos": Json,"p_foto_ruta"?: string,"p_perfil_id": string,"p_tipos": (string)[] }; Returns: undefined
                           },
"iniciar_revision_profesional":
{ Args: { "p_version_id": string }; Returns: string
                           },
"nombres_abogados_participantes":
{ Args: { "p_perfiles": (string)[] }; Returns: {
              "nombre_profesional": string,"perfil_id": string
            }[]
                           },
"perfil_texto":
{ Args: { "p_claves": (string)[],"p_perfil": Json }; Returns: string
                           },
"preparar_version_profesional":
{ Args: { "p_identificacion"?: string,"p_perfil_id": string,"p_tarjeta": string }; Returns: string
                           },
"recuperar_perfil_profesional":
{ Args: { "p_documentos"?: (string)[],"p_perfil"?: Json }; Returns: string
                           },
"registrar_evidencia_profesional":
{ Args: { "p_ruta": string,"p_tipo": string,"p_version_id": string }; Returns: string
                           },
"ruta_fotografia_publicable":
{ Args: { "p_perfil_id": string }; Returns: string
                           }
          }
          Enums: {
            "estado_cuenta": "activa"|"suspendida"|"inactiva","estado_envio_correo": "no_aplica"|"pendiente"|"enviado"|"fallido","estado_peticion_priv": "pendiente"|"en_proceso"|"resuelta","estado_revision_prof": "pendiente"|"en_revision"|"aprobada"|"rechazada"|"requiere_correcciones","estado_solicitud": "pendiente"|"aceptada"|"rechazada"|"cancelada","evento_noti": "nueva_solicitud"|"nuevo_mensaje"|"revision_resuelta"|"privacidad_resuelta"|"solicitud_aceptada"|"solicitud_rechazada"|"perfil_suspendido"|"solicitud_cancelada","rol_cuenta": "ciudadano"|"abogado"|"administrador","tipo_doc_legal": "terminos_condiciones"|"politica_privacidad"|"tratamiento_datos","tipo_peticion_priv": "acceso"|"rectificacion"|"cancelacion"|"oposicion"|"desactivacion"|"supresion","tipo_revision_prof": "inicial"|"revalidacion"|"reporte","visibilidad_perfil": "publico"|"oculto"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "estado_cuenta": ["activa", "suspendida", "inactiva"],"estado_envio_correo": ["no_aplica", "pendiente", "enviado", "fallido"],"estado_peticion_priv": ["pendiente", "en_proceso", "resuelta"],"estado_revision_prof": ["pendiente", "en_revision", "aprobada", "rechazada", "requiere_correcciones"],"estado_solicitud": ["pendiente", "aceptada", "rechazada", "cancelada"],"evento_noti": ["nueva_solicitud", "nuevo_mensaje", "revision_resuelta", "privacidad_resuelta", "solicitud_aceptada", "solicitud_rechazada", "perfil_suspendido", "solicitud_cancelada"],"rol_cuenta": ["ciudadano", "abogado", "administrador"],"tipo_doc_legal": ["terminos_condiciones", "politica_privacidad", "tratamiento_datos"],"tipo_peticion_priv": ["acceso", "rectificacion", "cancelacion", "oposicion", "desactivacion", "supresion"],"tipo_revision_prof": ["inicial", "revalidacion", "reporte"],"visibilidad_perfil": ["publico", "oculto"]
          }
        }
} as const
