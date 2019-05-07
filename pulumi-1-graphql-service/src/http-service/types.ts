import * as pulumi from '@pulumi/pulumi'
import {ServiceLambdaFunction} from '../service'

export type HttpServiceResourceMap = {
  [pathPart: string]: HttpServiceResourceConfig
}

export type HttpServiceResourceConfig = {
  children?: HttpServiceResourceMap
  methods: {
    DELETE?: ServiceResourceMethod
    GET?: ServiceResourceMethod
    HEAD?: ServiceResourceMethod
    OPTIONS?: ServiceResourceMethod
    PATCH?: ServiceResourceMethod
    POST?: ServiceResourceMethod
    PUT?: ServiceResourceMethod
  }
}

export type ServiceResourceMethod = {
  lambda: pulumi.Input<ServiceLambdaFunction>
}
